import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  AdminUser,
  User,
  CustomerService,
  CapsuleAccessLog,
  Payment,
} from '../entities';
import { AdminAuthController } from './auth/admin-auth.controller';
import { AdminAuthService } from './auth/admin-auth.service';
import { AdminJwtStrategy } from './auth/strategies/admin-jwt.strategy';
import { AdminDashboardController } from './dashboard/admin-dashboard.controller';
import { AdminDashboardService } from './dashboard/admin-dashboard.service';
import { AdminUsersController } from './users/admin-users.controller';
import { AdminUsersService } from './users/admin-users.service';

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService): JwtModuleOptions => ({
        secret:
          configService.get<string>('ADMIN_JWT_SECRET') ||
          configService.get<string>('JWT_SECRET') ||
          'default-secret',
      }),
    }),
    TypeOrmModule.forFeature([
      AdminUser,
      User,
      CustomerService,
      CapsuleAccessLog,
      Payment,
    ]),
  ],
  controllers: [
    AdminAuthController,
    AdminDashboardController,
    AdminUsersController,
  ],
  providers: [
    AdminAuthService,
    AdminJwtStrategy,
    AdminDashboardService,
    AdminUsersService,
  ],
})
export class AdminModule {}
