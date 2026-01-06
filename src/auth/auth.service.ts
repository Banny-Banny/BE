import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes, scrypt as _scrypt, timingSafeEqual } from 'crypto';
import { Repository } from 'typeorm';
import { promisify } from 'util';
import { User, Capsule, Friendship } from '../entities';
import { LocalLoginRequestDto } from './dto/local-login.request.dto';
import { LocalSignupRequestDto } from './dto/local-signup.request.dto';
import { FriendStatus } from '../common/enums';

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
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Capsule)
    private readonly capsuleRepository: Repository<Capsule>,
    @InjectRepository(Friendship)
    private readonly friendshipRepository: Repository<Friendship>,
    private readonly jwtService: JwtService,
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

    // 캡슐 개수 (삭제되지 않은 모든 캡슐)
    const capsuleCount = await this.capsuleRepository
      .createQueryBuilder('capsule')
      .where('capsule.user_id = :userId', { userId })
      .andWhere('capsule.deleted_at IS NULL')
      .getCount();

    // 이스터에그 개수 (viewLimit > 0인 캡슐)
    const easterEggCount = await this.capsuleRepository
      .createQueryBuilder('capsule')
      .where('capsule.user_id = :userId', { userId })
      .andWhere('capsule.view_limit > 0')
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
        capsuleCount,
        easterEggCount,
        friendCount,
      },
    };
  }
}
