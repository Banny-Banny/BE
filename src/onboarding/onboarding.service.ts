import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities';
import { CompleteOnboardingDto } from './dto';

/**
 * 온보딩 관련 비즈니스 로직 처리
 */
@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * 온보딩 완료 처리
   * - 친구 동의 및 위치 동의 정보 저장
   * - 온보딩 완료 시점 기록
   * - 중복 호출 시 기존 데이터 업데이트 (Upsert)
   */
  async completeOnboarding(
    userId: string,
    dto: CompleteOnboardingDto,
  ): Promise<{ success: boolean }> {
    this.logger.log(
      `온보딩 완료 처리 시작 - userId: ${userId}, friendConsent: ${dto.friend_consent}, locationConsent: ${dto.location_consent}`,
    );

    try {
      // 사용자 조회
      const user = await this.userRepository.findOne({
        where: { id: userId },
      });

      if (!user) {
        throw new Error('사용자를 찾을 수 없습니다.');
      }

      // 온보딩 정보 업데이트 (Upsert 방식)
      user.isFriendConsentAgreed = dto.friend_consent;
      user.isLocationConsentAgreed = dto.location_consent;

      // 처음 온보딩 완료하는 경우에만 완료 시점 기록
      if (!user.onboardingCompletedAt) {
        user.onboardingCompletedAt = new Date();
        this.logger.log(
          `온보딩 첫 완료 - userId: ${userId}, completedAt: ${user.onboardingCompletedAt.toISOString()}`,
        );
      } else {
        this.logger.log(
          `온보딩 정보 업데이트 - userId: ${userId}, 기존 완료 시점: ${user.onboardingCompletedAt.toISOString()}`,
        );
      }

      // 저장
      await this.userRepository.save(user);

      this.logger.log(`온보딩 완료 처리 성공 - userId: ${userId}`);

      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `온보딩 완료 처리 실패 - userId: ${userId}, error: ${message}`,
        stack,
      );
      throw error instanceof Error ? error : new Error(message);
    }
  }

  /**
   * 온보딩 완료 여부 조회
   */
  async isOnboardingCompleted(userId: string): Promise<boolean> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'onboardingCompletedAt'],
    });

    return !!user?.onboardingCompletedAt;
  }
}
