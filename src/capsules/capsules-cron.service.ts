import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource, LessThan, In, IsNull } from 'typeorm';
import { Capsule } from '../entities/capsule.entity';
import { CapsuleParticipantSlot } from '../entities/capsule-participant-slot.entity';
import { RoomStatus } from '../common/enums';

@Injectable()
export class CapsulesCronService {
  private readonly logger = new Logger(CapsulesCronService.name);

  constructor(
    @InjectRepository(Capsule)
    private readonly capsuleRepository: Repository<Capsule>,
    @InjectRepository(CapsuleParticipantSlot)
    private readonly slotRepository: Repository<CapsuleParticipantSlot>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
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
      const expiredCapsules = await this.capsuleRepository.find({
        where: {
          deadline: LessThan(now),
          roomStatus: In([RoomStatus.WAITING, RoomStatus.COMPLETED]),
          deletedAt: IsNull(),
        },
        relations: ['order'],
      });

      this.logger.log(`✅ 자동 제출 대상 캡슐: ${expiredCapsules.length}개`);

      if (expiredCapsules.length === 0) {
        return;
      }

      // 2. 각 캡슐 자동 매장
      for (const capsule of expiredCapsules) {
        try {
          await this.autoSubmitCapsule(capsule);
          this.logger.log(`✅ 캡슐 자동 제출 완료: ${capsule.id}`);
        } catch (error) {
          this.logger.error(
            `❌ 캡슐 자동 제출 실패: ${capsule.id}`,
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
  private async autoSubmitCapsule(capsule: Capsule): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const capsuleRepo = manager.getRepository(Capsule);

      // 1. 방장 슬롯 조회
      const ownerSlot = await manager.getRepository(CapsuleParticipantSlot).findOne({
        where: { capsuleId: capsule.id, slotIndex: 0 },
      });

      // 2. 기본 위치 설정
      let latitude = 37.5665; // 서울시청 (기본값)
      let longitude = 126.978;

      // 방장이 위치를 저장한 경우 (향후 구현)
      // if (ownerSlot?.savedLatitude) {
      //   latitude = ownerSlot.savedLatitude;
      //   longitude = ownerSlot.savedLongitude;
      // }

      // 3. 캡슐 매장
      capsule.latitude = latitude;
      capsule.longitude = longitude;
      capsule.roomStatus = RoomStatus.BURIED;
      capsule.buriedAt = new Date();
      capsule.isAutoSubmitted = true;

      await capsuleRepo.save(capsule);

      // 4. TODO: 알림 발송 (참여자 전원)
      // await this.sendAutoSubmitNotifications(capsule);
    });
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

