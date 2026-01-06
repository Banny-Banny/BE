import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { CapsulesModule } from './capsules/capsules.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { MediaModule } from './media/media.module';
import { MeModule } from './me/me.module';

@Module({
  imports: [
    // 환경 변수 설정 (전역)
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // 데이터베이스 모듈
    DatabaseModule,
    // 인증 모듈 (카카오 소셜로그인)
    AuthModule,
    // 이스터에그/캡슐 모듈
    CapsulesModule,
    OrdersModule,
    PaymentsModule,
    MediaModule,
    // 마이페이지 모듈
    MeModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
