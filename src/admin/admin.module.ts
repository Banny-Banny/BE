import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  AdminUser,
  User,
  CustomerService,
  CustomerServiceMessage,
  CapsuleAccessLog,
  Payment,
  Notice,
  Order,
  Product,
} from '../entities';
import { AdminAuthController } from './auth/admin-auth.controller';
import { AdminAuthService } from './auth/admin-auth.service';
import { AdminJwtStrategy } from './auth/strategies/admin-jwt.strategy';
import { AdminDashboardController } from './dashboard/admin-dashboard.controller';
import { AdminDashboardService } from './dashboard/admin-dashboard.service';
import { AdminUsersController } from './users/admin-users.controller';
import { AdminUsersService } from './users/admin-users.service';
import { AdminInquiriesController } from './inquiries/admin-inquiries.controller';
import { AdminInquiriesService } from './inquiries/admin-inquiries.service';
import { AdminChatGateway } from './inquiries/admin-chat.gateway';
import { UserChatGateway } from './inquiries/user-chat.gateway';
import { AuthModule } from '../auth/auth.module';
import { NoticesModule } from '../notices/notices.module';
import { PaymentsModule } from '../payments/payments.module';
import { CapsulesModule } from '../capsules/capsules.module';
import { AdminNoticesController } from './notices/admin-notices.controller';
import { AdminProductsController } from './products/admin-products.controller';
import { AdminProductsService } from './products/admin-products.service';
import { AdminAdminsController } from './admins/admin-admins.controller';
import { AdminAdminsService } from './admins/admin-admins.service';

@Module({
  imports: [
    ConfigModule,
    AuthModule,
    NoticesModule,
    PaymentsModule,
    CapsulesModule,
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
      CustomerServiceMessage,
      CapsuleAccessLog,
      Payment,
      Notice,
      Order,
      Product,
    ]),
  ],
  controllers: [
    AdminAuthController,
    AdminAdminsController,
    AdminDashboardController,
    AdminUsersController,
    AdminInquiriesController,
    AdminNoticesController,
    AdminProductsController,
  ],
  providers: [
    AdminAuthService,
    AdminJwtStrategy,
    AdminAdminsService,
    AdminDashboardService,
    AdminUsersService,
    AdminInquiriesService,
    AdminChatGateway,
    UserChatGateway,
    AdminProductsService,
  ],
})
export class AdminModule {}
