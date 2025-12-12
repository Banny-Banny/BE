import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-kakao';
import { ConfigService } from '@nestjs/config';
import { AuthService, KakaoUserInfo } from '../auth.service';

interface KakaoProfile {
  nickname?: string;
  profile_image?: string;
}

interface KakaoAccount {
  email?: string;
  profile?: {
    nickname?: string;
    profile_image_url?: string;
  };
}

interface KakaoJson {
  properties?: KakaoProfile;
  kakao_account?: KakaoAccount;
}

@Injectable()
export class KakaoStrategy extends PassportStrategy(Strategy, 'kakao') {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      clientID: configService.get<string>('KAKAO_CLIENT_ID') || '',
      clientSecret: configService.get<string>('KAKAO_CLIENT_SECRET') || '',
      callbackURL:
        configService.get<string>('KAKAO_CALLBACK_URL') ||
        'http://localhost:3000/auth/kakao/callback',
    });
  }

  /**
   * 카카오 로그인 성공 시 호출되는 콜백
   */
  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: (error: Error | null, user?: unknown) => void,
  ) {
    try {
      const { id, username } = profile;
      const json = profile._json as KakaoJson;

      // 카카오 프로필에서 정보 추출
      const kakaoUserInfo: KakaoUserInfo = {
        kakaoId: String(id),
        nickname:
          username ||
          json?.properties?.nickname ||
          json?.kakao_account?.profile?.nickname ||
          '카카오유저',
        email: json?.kakao_account?.email,
        profileImg:
          json?.properties?.profile_image ||
          json?.kakao_account?.profile?.profile_image_url,
      };

      // AuthService를 통해 로그인/회원가입 처리
      const result = await this.authService.kakaoLogin(kakaoUserInfo);

      done(null, result);
    } catch (error) {
      done(error as Error);
    }
  }
}
