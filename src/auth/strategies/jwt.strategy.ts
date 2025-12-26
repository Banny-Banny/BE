import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService, JwtPayload } from '../auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'default-secret',
    });

    // Debug logging for e2e env to verify secret wiring
    const secret = configService.get<string>('JWT_SECRET') || 'default-secret';
    if (process.env.PLAYWRIGHT === 'true' || process.env.NODE_ENV === 'test') {
      // nest logger 대신 테스트 편의용
      console.log(`[jwt] secret(prefixed)=${secret.slice(0, 4)}***`);
    }
  }

  /**
   * JWT 토큰 검증 후 호출되는 콜백
   * 반환값이 req.user에 저장됨
   */
  async validate(payload: JwtPayload) {
    const user = await this.authService.validateToken(payload);

    if (!user) {
      throw new UnauthorizedException('유효하지 않은 토큰입니다.');
    }

    return user;
  }
}
