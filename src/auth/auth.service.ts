import { BadRequestException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities';

export interface KakaoUserInfo {
  kakaoId: string;
  nickname: string;
  email?: string;
  profileImg?: string;
}

export interface JwtPayload {
  sub: string; // user id
  nickname: string;
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

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
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

    const accessToken = this.generateToken(user);

    return {
      accessToken,
      user: {
        id: user.id,
        nickname: user.nickname,
        email: user.email,
        profileImg: user.profileImg,
        isNewUser,
      },
    };
  }

  /**
   * JWT 토큰 생성
   */
  generateToken(user: User): string {
    const payload: JwtPayload = {
      sub: user.id,
      nickname: user.nickname,
    };
    return this.jwtService.sign(payload);
  }

  /**
   * 유저 ID로 조회
   */
  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id, isActive: true },
    });
  }

  /**
   * JWT 토큰 검증
   */
  async validateToken(payload: JwtPayload): Promise<User | null> {
    return this.findById(payload.sub);
  }
}
