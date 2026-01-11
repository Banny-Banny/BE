import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';
import { User } from '../entities';

/**
 * 온보딩 모듈
 * - 온보딩 완료 처리
 * - 친구 동의 및 위치 동의 정보 저장
 */
@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [OnboardingController],
  providers: [OnboardingService],
  exports: [OnboardingService],
})
export class OnboardingModule {}
