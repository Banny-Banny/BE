import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes, scrypt as _scrypt, timingSafeEqual } from 'crypto';
import { Repository } from 'typeorm';
import { promisify } from 'util';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { User, Capsule, Friendship } from '../entities';
import { LocalLoginRequestDto } from './dto/local-login.request.dto';
import { LocalSignupRequestDto } from './dto/local-signup.request.dto';
import { FriendStatus } from '../common/enums';
import { KakaoFriendsSyncRequestDto } from './dto/kakao-friends-sync.request.dto';

export interface KakaoUserInfo {
  kakaoId: string;
  nickname: string;
  email?: string;
  profileImg?: string;
}

export interface JwtPayload {
  sub: string; // user id
  nickname: string;
  tokenVersion?: number;
}

export interface TokenResponse {
  accessToken: string;
  user: {
    id: string;
    nickname: string;
    email: string | null;
    profileImg: string | null;
    isNewUser: boolean;
  };
}

const PASSWORD_SALT_BYTES = 16;
const PASSWORD_KEY_LEN = 64;
const scryptAsync = promisify(_scrypt);

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Capsule)
    private readonly capsuleRepository: Repository<Capsule>,
    @InjectRepository(Friendship)
    private readonly friendshipRepository: Repository<Friendship>,
    private readonly jwtService: JwtService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * 카카오 로그인 처리
   * - 기존 유저: 정보 업데이트 후 토큰 발급
   * - 신규 유저: 회원가입 후 토큰 발급
   */
  async kakaoLogin(kakaoUserInfo: KakaoUserInfo): Promise<TokenResponse> {
    if (!kakaoUserInfo.kakaoId) {
      throw new BadRequestException('카카오 ID가 없습니다.');
    }

    const nickname =
      kakaoUserInfo.nickname && kakaoUserInfo.nickname.trim().length > 0
        ? kakaoUserInfo.nickname.trim()
        : '카카오유저';

    let user = await this.userRepository.findOne({
      where: { kakaoId: kakaoUserInfo.kakaoId },
    });

    let isNewUser = false;

    if (!user) {
      // 신규 유저 생성
      isNewUser = true;
      const newUserData: Partial<User> = {
        kakaoId: kakaoUserInfo.kakaoId,
        provider: 'KAKAO',
        nickname,
        phoneNumber: `kakao_${kakaoUserInfo.kakaoId}`, // 임시 전화번호 (추후 업데이트 필요)
      };

      if (kakaoUserInfo.email) {
        newUserData.email = kakaoUserInfo.email;
      }
      if (kakaoUserInfo.profileImg) {
        newUserData.profileImg = kakaoUserInfo.profileImg;
      }

      user = this.userRepository.create(newUserData);
      await this.userRepository.save(user);
    } else {
      // 기존 유저 정보 업데이트
      user.nickname = nickname || user.nickname;
      if (kakaoUserInfo.email) user.email = kakaoUserInfo.email;
      if (kakaoUserInfo.profileImg) user.profileImg = kakaoUserInfo.profileImg;
      await this.userRepository.save(user);
    }

    return this.buildTokenResponse(user, isNewUser);
  }

  async signupLocal(dto: LocalSignupRequestDto): Promise<TokenResponse> {
    const phoneNumber = dto.phoneNumber.trim();
    const email = dto.email?.trim();

    const duplicatePhone = await this.userRepository.findOne({
      where: { phoneNumber },
    });
    if (duplicatePhone) {
      throw new ConflictException('이미 사용 중인 전화번호입니다.');
    }

    if (email) {
      const duplicateEmail = await this.userRepository.findOne({
        where: { email },
      });
      if (duplicateEmail) {
        throw new ConflictException('이미 사용 중인 이메일입니다.');
      }
    }

    const hashedPassword = await this.hashPassword(dto.password);

    const user = this.userRepository.create();
    user.nickname = dto.nickname.trim();
    user.phoneNumber = phoneNumber;
    user.passwordHash = hashedPassword;
    user.email = email ?? null;
    user.profileImg = dto.profileImg ?? null;
    user.provider = 'LOCAL';
    user.isActive = true;
    user.tokenVersion = 0;

    await this.userRepository.save(user);

    return this.buildTokenResponse(user, true);
  }

  async loginLocal(dto: LocalLoginRequestDto): Promise<TokenResponse> {
    const phoneNumber = dto.phoneNumber?.trim();
    const email = dto.email?.trim();

    if (!phoneNumber && !email) {
      throw new BadRequestException('휴대폰 또는 이메일을 입력해야 합니다.');
    }

    const where = phoneNumber ? { phoneNumber } : { email: email! };

    const user = await this.userRepository.findOne({
      where,
    });

    if (!user) {
      throw new UnauthorizedException('등록된 계정이 없습니다.');
    }

    if (user.provider !== 'LOCAL') {
      throw new ForbiddenException('로컬 계정으로 로그인할 수 없습니다.');
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException('비밀번호가 설정되지 않은 계정입니다.');
    }

    const matches = await this.verifyPassword(dto.password, user.passwordHash);

    if (!matches) {
      throw new UnauthorizedException('비밀번호가 일치하지 않습니다.');
    }

    if (!user.isActive) {
      throw new ForbiddenException('정지된 계정입니다.');
    }

    return this.buildTokenResponse(user, false);
  }

  async logout(user: User): Promise<void> {
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    await this.userRepository.save(user);
  }

  /**
   * JWT 토큰 생성
   */
  generateToken(user: User): string {
    const payload: JwtPayload = {
      sub: user.id,
      nickname: user.nickname,
      tokenVersion: user.tokenVersion ?? 0,
    };
    return this.jwtService.sign(payload);
  }

  private buildTokenResponse(user: User, isNewUser: boolean): TokenResponse {
    return {
      accessToken: this.generateToken(user),
      user: {
        id: user.id,
        nickname: user.nickname,
        email: user.email ?? null,
        profileImg: user.profileImg ?? null,
        isNewUser,
      },
    };
  }

  /**
   * 유저 ID로 조회
   */
  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id, isActive: true },
    });
  }

  private async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(PASSWORD_SALT_BYTES).toString('hex');
    const derived = (await scryptAsync(
      password,
      salt,
      PASSWORD_KEY_LEN,
    )) as Buffer;
    return `${salt}:${derived.toString('hex')}`;
  }

  private async verifyPassword(
    password: string,
    storedHash: string | null,
  ): Promise<boolean> {
    if (!storedHash) {
      return false;
    }
    const [salt, keyHex] = storedHash.split(':');
    if (!salt || !keyHex) {
      return false;
    }
    const derived = (await scryptAsync(
      password,
      salt,
      PASSWORD_KEY_LEN,
    )) as Buffer;
    try {
      return timingSafeEqual(Buffer.from(keyHex, 'hex'), derived);
    } catch {
      return false;
    }
  }

  /**
   * JWT 토큰 검증
   */
  async validateToken(payload: JwtPayload): Promise<User | null> {
    if (process.env.PLAYWRIGHT === 'true' || process.env.NODE_ENV === 'test') {
      console.log('[auth] validateToken payload', payload);
    }
    const user = await this.findById(payload.sub);
    if (!user) {
      if (
        process.env.PLAYWRIGHT === 'true' ||
        process.env.NODE_ENV === 'test'
      ) {
        console.log('[auth] user not found for', payload.sub);
      }
      return null;
    }

    const tokenVersion = payload.tokenVersion ?? 0;
    const storedVersion = user.tokenVersion ?? 0;
    if (tokenVersion !== storedVersion) {
      if (
        process.env.PLAYWRIGHT === 'true' ||
        process.env.NODE_ENV === 'test'
      ) {
        console.log(
          '[auth] token version mismatch',
          tokenVersion,
          storedVersion,
        );
      }
      return null;
    }

    return user;
  }

  /**
   * 사용자 프로필 정보 조회 (통계 포함)
   */
  async getUserProfile(userId: string) {
    const user = await this.findById(userId);
    if (!user) {
      throw new UnauthorizedException('사용자를 찾을 수 없습니다.');
    }

    // 타임캡슐 개수 (product_id가 있는 캡슐)
    const timeCapsuleCount = await this.capsuleRepository
      .createQueryBuilder('capsule')
      .where('capsule.user_id = :userId', { userId })
      .andWhere('capsule.product_id IS NOT NULL')
      .andWhere('capsule.deleted_at IS NULL')
      .getCount();

    // 이스터에그 개수 (product_id가 없는 캡슐)
    const easterEggCount = await this.capsuleRepository
      .createQueryBuilder('capsule')
      .where('capsule.user_id = :userId', { userId })
      .andWhere('capsule.product_id IS NULL')
      .andWhere('capsule.deleted_at IS NULL')
      .getCount();

    // 친구 수 (CONNECTED 상태만)
    // Friendship은 user_id < friend_id 정책이므로 양방향 체크
    const friendCount = await this.friendshipRepository
      .createQueryBuilder('friendship')
      .where(
        '(friendship.user_id = :userId OR friendship.friend_id = :userId)',
        { userId },
      )
      .andWhere('friendship.status = :status', {
        status: FriendStatus.CONNECTED,
      })
      .getCount();

    return {
      nickname: user.nickname,
      email: user.email,
      profileImageUrl: user.profileImg,
      summary: {
        timeCapsuleCount,
        easterEggCount,
        friendCount,
      },
    };
  }

  /**
   * 카카오 친구 동기화
   * 1. 인가 코드로 액세스 토큰 발급
   * 2. 카카오 친구 목록 조회
   * 3. 우리 서비스 가입자만 필터링
   * 4. Friendship 테이블에 저장
   */
  async syncKakaoFriends(
    user: User,
    dto: KakaoFriendsSyncRequestDto,
  ): Promise<{ isSynced: boolean; syncedCount: number; lastSyncedAt: Date }> {
    this.logger.log(
      `[카카오 친구 동기화 시작] userId: ${user.id}, code: ${dto.code.substring(0, 10)}...`,
    );

    // 1. 인가 코드로 액세스 토큰 발급
    const tokenData = await this.getKakaoAccessToken(dto.code, dto.redirectUri);

    if (!tokenData.access_token) {
      throw new BadRequestException('카카오 액세스 토큰 발급 실패');
    }

    // 2. 카카오 친구 목록 조회
    const kakaoFriends = await this.getKakaoFriends(tokenData.access_token);

    this.logger.log(`[카카오 친구 목록 조회 완료] 총 ${kakaoFriends.length}명`);

    // 3. 카카오 친구 중 우리 서비스에 가입된 유저 찾기
    const kakaoIds = kakaoFriends.map((friend) => String(friend.id));
    const registeredUsers = await this.userRepository
      .createQueryBuilder('user')
      .where('user.kakao_id IN (:...kakaoIds)', { kakaoIds })
      .andWhere('user.is_active = :isActive', { isActive: true })
      .getMany();

    this.logger.log(
      `[서비스 가입자 필터링] ${registeredUsers.length}명이 우리 서비스 사용 중`,
    );

    // 4. Friendship 테이블에 저장 (user_id < friend_id 정책)
    let syncedCount = 0;
    for (const friendUser of registeredUsers) {
      // 본인은 제외
      if (friendUser.id === user.id) {
        continue;
      }

      // user_id < friend_id 순서로 정렬
      const [smallerId, largerId] =
        user.id < friendUser.id
          ? [user.id, friendUser.id]
          : [friendUser.id, user.id];

      // 이미 존재하는 친구 관계 확인
      const existingFriendship = await this.friendshipRepository.findOne({
        where: {
          userId: smallerId,
          friendId: largerId,
        },
      });

      if (!existingFriendship) {
        // 새로운 친구 관계 생성
        const friendship = this.friendshipRepository.create({
          userId: smallerId,
          friendId: largerId,
          status: FriendStatus.CONNECTED,
        });
        await this.friendshipRepository.save(friendship);
        syncedCount++;
        this.logger.log(
          `[친구 추가] ${smallerId} <-> ${largerId} (${friendUser.nickname})`,
        );
      } else if (existingFriendship.status !== FriendStatus.CONNECTED) {
        // 기존 관계가 PENDING 또는 BLOCKED인 경우 CONNECTED로 업데이트
        existingFriendship.status = FriendStatus.CONNECTED;
        await this.friendshipRepository.save(existingFriendship);
        syncedCount++;
        this.logger.log(
          `[친구 상태 업데이트] ${smallerId} <-> ${largerId} -> CONNECTED`,
        );
      }
    }

    // 5. User에 토큰 및 동기화 시간 저장
    user.kakaoAccessToken = tokenData.access_token;
    user.kakaoRefreshToken = tokenData.refresh_token || null;
    user.lastKakaoFriendsSyncAt = new Date();
    await this.userRepository.save(user);

    this.logger.log(
      `[카카오 친구 동기화 완료] 총 ${syncedCount}명의 친구가 추가/업데이트됨`,
    );

    return {
      isSynced: true,
      syncedCount,
      lastSyncedAt: user.lastKakaoFriendsSyncAt,
    };
  }

  /**
   * 카카오 인가 코드로 액세스 토큰 발급
   */

  private async getKakaoAccessToken(
    code: string,
    redirectUri: string,
  ): Promise<{
    access_token: string;
    token_type: string;
    refresh_token?: string;
    expires_in: number;
    scope?: string;
  }> {
    const clientId = this.configService.get<string>('KAKAO_CLIENT_ID');
    const clientSecret = this.configService.get<string>('KAKAO_CLIENT_SECRET');

    if (!clientId) {
      throw new Error('KAKAO_CLIENT_ID 환경 변수가 설정되지 않았습니다.');
    }

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      redirect_uri: redirectUri,
      code,
    });

    if (clientSecret) {
      params.append('client_secret', clientSecret);
    }

    try {
      const response = await firstValueFrom(
        this.httpService.post<{
          access_token: string;
          token_type: string;
          refresh_token?: string;
          expires_in: number;
          scope?: string;
        }>('https://kauth.kakao.com/oauth/token', params.toString(), {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }),
      );

      return response.data;
    } catch (error: unknown) {
      this.logger.error('[카카오 토큰 발급 실패]', error);
      if (
        error &&
        typeof error === 'object' &&
        'response' in error &&
        error.response &&
        typeof error.response === 'object' &&
        'data' in error.response
      ) {
        const errorData = error.response.data as {
          error?: string;
          error_description?: string;
        };
        if (errorData.error === 'invalid_grant') {
          throw new BadRequestException(
            '유효하지 않거나 이미 사용된 카카오 인가 코드입니다.',
          );
        }
      }
      throw new BadRequestException('카카오 액세스 토큰 발급에 실패했습니다.');
    }
  }

  /**
   * 카카오 친구 목록 조회
   */

  private async getKakaoFriends(
    accessToken: string,
  ): Promise<Array<{ id: number; uuid: string; profile_nickname?: string }>> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<{
          elements: Array<{
            id: number;
            uuid: string;
            profile_nickname?: string;
          }>;
          total_count: number;
        }>('https://kapi.kakao.com/v1/api/talk/friends', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }),
      );

      const elements = response.data.elements || [];

      // friends 권한이 없는 경우 체크
      if (response.data.total_count === 0 && elements.length === 0) {
        // 권한이 없을 수도 있지만, 친구가 0명일 수도 있음
        // 에러를 던지는 대신 빈 배열 반환
        this.logger.warn(
          '[카카오 친구 목록 조회] 친구가 없거나 friends 권한이 부족할 수 있습니다.',
        );
      }

      return elements;
    } catch (error: unknown) {
      this.logger.error('[카카오 친구 목록 조회 실패]', error);

      // 권한 부족 에러 체크
      if (
        error &&
        typeof error === 'object' &&
        'response' in error &&
        error.response &&
        typeof error.response === 'object'
      ) {
        const response = error.response as {
          status?: number;
          data?: { code?: number; msg?: string };
        };
        if (response.status === 403 || response.data?.code === -402) {
          throw new ForbiddenException(
            '카카오 친구 목록 접근 권한이 없습니다. 동의창에서 친구 목록 항목을 체크해주세요.',
          );
        }
      }

      throw new BadRequestException('카카오 친구 목록 조회에 실패했습니다.');
    }
  }
}
