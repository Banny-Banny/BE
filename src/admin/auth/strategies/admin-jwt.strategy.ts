import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AdminAuthService, AdminJwtPayload } from '../admin-auth.service';

@Injectable()
export class AdminJwtStrategy extends PassportStrategy(Strategy, 'admin-jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly adminAuthService: AdminAuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('ADMIN_JWT_SECRET') ||
        configService.get<string>('JWT_SECRET') ||
        'default-secret',
    });
  }

  async validate(payload: AdminJwtPayload) {
    const admin = await this.adminAuthService.validateToken(payload);
    if (!admin) {
      throw new UnauthorizedException('유효하지 않은 관리자 토큰입니다.');
    }
    return admin;
  }
}
