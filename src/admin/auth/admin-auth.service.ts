import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import {
  createHash,
  randomBytes,
  scrypt as _scrypt,
  timingSafeEqual,
} from 'crypto';
import { Repository } from 'typeorm';
import { promisify } from 'util';
import { AdminUser } from '../../entities';
import { AdminRole } from '../../common/enums';
import { AdminLoginDto } from './dto/admin-login.dto';
import { AdminCreateDto } from './dto/admin-create.dto';
import { AdminRefreshDto } from './dto/admin-refresh.dto';

export interface AdminJwtPayload {
  sub: string;
  role: AdminRole;
  tokenVersion: number;
}

export interface AdminTokenResponse {
  accessToken: string;
  refreshToken: string;
  admin: {
    id: string;
    email: string;
    name: string;
    role: AdminRole;
  };
}

const PASSWORD_SALT_BYTES = 16;
const PASSWORD_KEY_LEN = 64;
const scryptAsync = promisify(_scrypt);

@Injectable()
export class AdminAuthService {
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly accessExpiresIn: JwtSignOptions['expiresIn'];
  private readonly refreshExpiresIn: JwtSignOptions['expiresIn'];

  constructor(
    @InjectRepository(AdminUser)
    private readonly adminRepository: Repository<AdminUser>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.accessSecret =
      this.configService.get<string>('ADMIN_JWT_SECRET') ||
      this.configService.get<string>('JWT_SECRET') ||
      'default-secret';
    this.refreshSecret =
      this.configService.get<string>('ADMIN_JWT_REFRESH_SECRET') ||
      this.accessSecret;
    this.accessExpiresIn =
      (this.configService.get<string>('ADMIN_JWT_EXPIRES_IN') as
        | JwtSignOptions['expiresIn']
        | undefined) || '1h';
    this.refreshExpiresIn =
      (this.configService.get<string>('ADMIN_JWT_REFRESH_EXPIRES_IN') as
        | JwtSignOptions['expiresIn']
        | undefined) || '30d';
  }

  async login(dto: AdminLoginDto): Promise<AdminTokenResponse> {
    const email = dto.email.trim().toLowerCase();
    const admin = await this.adminRepository.findOne({ where: { email } });

    if (!admin) {
      throw new UnauthorizedException('등록된 관리자 계정이 없습니다.');
    }

    if (!admin.isActive) {
      throw new ForbiddenException('비활성화된 관리자 계정입니다.');
    }

    const matches = await this.verifyPassword(dto.password, admin.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('비밀번호가 일치하지 않습니다.');
    }

    return this.issueTokens(admin);
  }

  async createAdmin(
    currentAdmin: AdminUser,
    dto: AdminCreateDto,
  ): Promise<{ id: string; email: string; name: string; role: AdminRole }> {
    if (currentAdmin.role !== AdminRole.SUPER_ADMIN) {
      throw new ForbiddenException(
        '슈퍼 어드민만 관리자 계정을 생성할 수 있습니다.',
      );
    }

    const email = dto.email.trim().toLowerCase();
    const exists = await this.adminRepository.findOne({ where: { email } });
    if (exists) {
      throw new ConflictException('이미 존재하는 관리자 이메일입니다.');
    }

    const passwordHash = await this.hashPassword(dto.password);
    const admin = this.adminRepository.create({
      email,
      name: dto.name.trim(),
      passwordHash,
      role: AdminRole.ADMIN,
      isActive: true,
      tokenVersion: 0,
    });

    const saved = await this.adminRepository.save(admin);
    return this.buildAdminProfile(saved);
  }

  getProfile(admin: AdminUser) {
    return this.buildAdminProfile(admin);
  }

  async logout(admin: AdminUser): Promise<void> {
    admin.tokenVersion = (admin.tokenVersion ?? 0) + 1;
    admin.refreshTokenHash = null;
    await this.adminRepository.save(admin);
  }

  async refresh(dto: AdminRefreshDto): Promise<AdminTokenResponse> {
    let payload: AdminJwtPayload;
    try {
      payload = this.jwtService.verify<AdminJwtPayload>(dto.refreshToken, {
        secret: this.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('유효하지 않은 refresh token입니다.');
    }

    const admin = await this.adminRepository.findOne({
      where: { id: payload.sub },
    });

    if (!admin || !admin.isActive) {
      throw new UnauthorizedException('관리자 계정을 찾을 수 없습니다.');
    }

    const tokenVersion = payload.tokenVersion ?? 0;
    if (tokenVersion !== (admin.tokenVersion ?? 0)) {
      throw new UnauthorizedException('토큰 버전이 일치하지 않습니다.');
    }

    const refreshHash = this.hashToken(dto.refreshToken);
    if (
      !admin.refreshTokenHash ||
      !this.safeCompare(admin.refreshTokenHash, refreshHash)
    ) {
      throw new UnauthorizedException('refresh token이 일치하지 않습니다.');
    }

    return this.issueTokens(admin);
  }

  async validateToken(payload: AdminJwtPayload): Promise<AdminUser | null> {
    const admin = await this.adminRepository.findOne({
      where: { id: payload.sub },
    });
    if (!admin || !admin.isActive) {
      return null;
    }

    const tokenVersion = payload.tokenVersion ?? 0;
    if (tokenVersion !== (admin.tokenVersion ?? 0)) {
      return null;
    }

    return admin;
  }

  async validateAccessToken(token: string): Promise<AdminUser | null> {
    try {
      const payload = this.jwtService.verify<AdminJwtPayload>(token, {
        secret: this.accessSecret,
      });
      return this.validateToken(payload);
    } catch {
      return null;
    }
  }

  private async issueTokens(admin: AdminUser): Promise<AdminTokenResponse> {
    const payload: AdminJwtPayload = {
      sub: admin.id,
      role: admin.role,
      tokenVersion: admin.tokenVersion ?? 0,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.accessSecret,
      expiresIn: this.accessExpiresIn,
    });
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.refreshSecret,
      expiresIn: this.refreshExpiresIn,
    });

    admin.refreshTokenHash = this.hashToken(refreshToken);
    await this.adminRepository.save(admin);

    return {
      accessToken,
      refreshToken,
      admin: this.buildAdminProfile(admin),
    };
  }

  private buildAdminProfile(admin: AdminUser) {
    return {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
    };
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
    storedHash: string,
  ): Promise<boolean> {
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

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private safeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  }
}
