import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource, LessThan, In, IsNull, Between } from 'typeorm';
import { Capsule } from '../entities/capsule.entity';
import { TimeCapsule } from '../entities/time-capsule.entity';
import { CapsuleParticipantSlot } from '../entities/capsule-participant-slot.entity';
import { RoomStatus } from '../common/enums';
import { PushNotificationService } from '../common/services/push-notification.service';
import { NotificationType } from '../common/enums/notification-type.enum';

@Injectable()
export class CapsulesCronService {
  private readonly logger = new Logger(CapsulesCronService.name);

  constructor(
    @InjectRepository(Capsule)
    private readonly capsuleRepository: Repository<Capsule>,
    @InjectRepository(TimeCapsule)
    private readonly timeCapsuleRepository: Repository<TimeCapsule>,
    @InjectRepository(CapsuleParticipantSlot)
    private readonly slotRepository: Repository<CapsuleParticipantSlot>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly pushNotificationService: PushNotificationService,
  ) {}

  /**
   * 매 시간 실행: deadline 경과 캡슐 자동 제출
   */
  @Cron(CronExpression.EVERY_HOUR)
  async handleAutoSubmit(): Promise<void> {
    this.logger.log('🕐 [크론잡 시작] 자동 제출 처리 시작');

    try {
      // 1. deadline 경과 + 미제출 캡슐 조회
      const now = new Date();
      const expiredCapsules = await this.timeCapsuleRepository.find({
        where: {
          deadline: LessThan(now),
          roomStatus: In([RoomStatus.WAITING, RoomStatus.COMPLETED]),
          capsule: { deletedAt: IsNull() },
        },
        relations: { capsule: true },
      });

      this.logger.log(`✅ 자동 제출 대상 캡슐: ${expiredCapsules.length}개`);

      if (expiredCapsules.length === 0) {
        return;
      }

      // 2. 각 캡슐 자동 매장
      for (const timeCapsule of expiredCapsules) {
        try {
          await this.autoSubmitCapsule(timeCapsule);
          this.logger.log(`✅ 캡슐 자동 제출 완료: ${timeCapsule.capsuleId}`);
        } catch (error) {
          this.logger.error(
            `❌ 캡슐 자동 제출 실패: ${timeCapsule.capsuleId}`,
            error instanceof Error ? error.stack : error,
          );
        }
      }

      this.logger.log('🎉 [크론잡 완료] 자동 제출 처리 완료');
    } catch (error) {
      this.logger.error(
        '❌ [크론잡 에러] 자동 제출 처리 중 오류 발생',
        error instanceof Error ? error.stack : error,
      );
    }
  }

  /**
   * 개별 캡슐 자동 제출
   */
  private async autoSubmitCapsule(timeCapsule: TimeCapsule): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const capsuleRepo = manager.getRepository(Capsule);
      const timeCapsuleRepo = manager.getRepository(TimeCapsule);

      // 1. 방장 슬롯 조회 (향후 구현: 방장이 저장한 위치 사용)
      // const ownerSlot = await manager
      //   .getRepository(CapsuleParticipantSlot)
      //   .findOne({
      //     where: { capsuleId: capsule.id, slotIndex: 0 },
      //   });

      // 2. 기본 위치 설정
      const latitude = 37.5665; // 서울시청 (기본값)
      const longitude = 126.978;

      // 방장이 위치를 저장한 경우 (향후 구현)
      // if (ownerSlot?.savedLatitude) {
      //   latitude = ownerSlot.savedLatitude;
      //   longitude = ownerSlot.savedLongitude;
      // }

      // 3. 캡슐 매장
      const capsule = await capsuleRepo.findOne({
        where: { id: timeCapsule.capsuleId },
      });
      if (!capsule) {
        return;
      }
      capsule.latitude = latitude;
      capsule.longitude = longitude;
      timeCapsule.roomStatus = RoomStatus.BURIED;
      timeCapsule.buriedAt = new Date();
      timeCapsule.isAutoSubmitted = true;

      await capsuleRepo.save(capsule);
      await timeCapsuleRepo.save(timeCapsule);

      // 4. TODO: 알림 발송 (참여자 전원)
      // await this.sendAutoSubmitNotifications(capsule);
    });
  }

  /**
   * 매 시간 실행: 타임캡슐 공개 시간 도래 시 알림 전송
   */
  @Cron(CronExpression.EVERY_HOUR)
  async handleCapsuleOpenNotifications(): Promise<void> {
    this.logger.log('🕐 [크론잡 시작] 타임캡슐 공개 알림 전송 시작');

    try {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      // 1. 최근 1시간 이내에 공개된 캡슐 조회 (BURIED 상태)
      const openedCapsules = await this.timeCapsuleRepository.find({
        where: {
          openAt: Between(oneHourAgo, now),
          roomStatus: RoomStatus.BURIED,
          capsule: { deletedAt: IsNull() },
        },
        relations: { capsule: true },
      });

      this.logger.log(`✅ 공개 알림 대상 캡슐: ${openedCapsules.length}개`);

      if (openedCapsules.length === 0) {
        return;
      }

      // 2. 각 캡슐의 소유자에게 알림 전송
      for (const timeCapsule of openedCapsules) {
        const capsule = timeCapsule.capsule;
        if (!capsule) {
          continue;
        }
        try {
          await this.pushNotificationService.createAndSendNotification(
            capsule.userId,
            NotificationType.CAPSULE_OPEN,
            '캡슐이 열렸어요',
            `${capsule.title} 캡슐이 공개되었습니다.`,
            {
              capsuleId: capsule.id,
            },
          );

          this.logger.log(
            `✅ 캡슐 공개 알림 전송 완료: ${capsule.id} -> ${capsule.userId}`,
          );
        } catch (error) {
          this.logger.error(
            `❌ 캡슐 공개 알림 전송 실패: ${capsule.id}`,
            error instanceof Error ? error.stack : error,
          );
        }
      }

      this.logger.log('🎉 [크론잡 완료] 타임캡슐 공개 알림 전송 완료');
    } catch (error) {
      this.logger.error(
        '❌ [크론잡 에러] 타임캡슐 공개 알림 전송 중 오류 발생',
        error instanceof Error ? error.stack : error,
      );
    }
  }

  /**
   * TODO: 자동 제출 알림 발송
   */
  // private async sendAutoSubmitNotifications(capsule: Capsule): Promise<void> {
  //   // 푸시/이메일 알림 발송 로직
  //   // 예: NotificationService.sendBulkNotification(participants, {
  //   //   type: 'AUTO_SUBMIT',
  //   //   title: '타임캡슐이 자동으로 매장되었습니다',
  //   //   message: `${capsule.title} 캡슐이 매장되었습니다. ${capsule.openAt} 에 개봉됩니다!`,
  //   // });
  // }
}
