import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import { User, Notification } from '../../entities';
import { NotificationType } from '../enums/notification-type.enum';

/**
 * 푸시 알림 전송 및 알림 생성 서비스
 * Expo Push Notification API를 사용하여 모바일 푸시 알림을 전송합니다.
 */
@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);
  private readonly expo: Expo;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
  ) {
    // Expo SDK 초기화
    this.expo = new Expo();
  }

  /**
   * 알림을 생성하고 푸시 알림을 전송합니다.
   * @param userId 알림을 받을 사용자 ID
   * @param type 알림 타입
   * @param title 알림 제목
   * @param content 알림 내용
   * @param data 추가 데이터 (optional)
   * @returns 생성된 알림 객체
   */
  async createAndSendNotification(
    userId: string,
    type: NotificationType,
    title: string,
    content: string,
    data?: Record<string, any>,
  ): Promise<Notification> {
    // 1. 알림 생성
    const notification = this.notificationRepository.create({
      userId,
      type,
      title,
      content,
    });

    await this.notificationRepository.save(notification);

    this.logger.log(
      `알림 생성됨: userId=${userId}, type=${type}, title=${title}`,
    );

    // 2. 푸시 알림 전송 (비동기, 실패해도 알림 생성은 완료됨)
    this.sendPushNotification(userId, title, content, type, data).catch(
      (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        const stack = error instanceof Error ? error.stack : undefined;
        this.logger.error(
          `푸시 알림 전송 실패: userId=${userId}, error=${message}`,
          stack,
        );
      },
    );

    return notification;
  }

  /**
   * 푸시 알림을 전송합니다.
   * @param userId 사용자 ID
   * @param title 알림 제목
   * @param body 알림 내용
   * @param type 알림 타입
   * @param data 추가 데이터 (optional)
   */
  private async sendPushNotification(
    userId: string,
    title: string,
    body: string,
    type: NotificationType,
    data?: Record<string, any>,
  ): Promise<void> {
    // 1. 사용자 조회 (푸시 토큰 및 알림 동의 여부 확인)
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'pushToken', 'isPushAgreed'],
    });

    if (!user) {
      this.logger.warn(`사용자를 찾을 수 없음: userId=${userId}`);
      return;
    }

    // 2. 푸시 알림 동의 여부 확인
    if (!user.isPushAgreed) {
      this.logger.log(
        `푸시 알림 비활성화된 사용자: userId=${userId}, 전송 스킵`,
      );
      return;
    }

    // 3. 푸시 토큰 확인
    if (!user.pushToken) {
      this.logger.log(`푸시 토큰이 없는 사용자: userId=${userId}, 전송 스킵`);
      return;
    }

    // 4. 푸시 토큰 유효성 검증
    if (!Expo.isExpoPushToken(user.pushToken)) {
      this.logger.warn(
        `유효하지 않은 푸시 토큰: userId=${userId}, token=${String(
          user.pushToken,
        )}`,
      );
      return;
    }

    // 5. 푸시 메시지 생성
    const message: ExpoPushMessage = {
      to: user.pushToken,
      sound: 'default',
      title,
      body,
      data: {
        type,
        ...data,
      },
      badge: 1,
    };

    try {
      // 6. 푸시 알림 전송
      const chunks = this.expo.chunkPushNotifications([message]);
      const tickets: ExpoPushTicket[] = [];

      for (const chunk of chunks) {
        try {
          const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
          tickets.push(...ticketChunk);
        } catch (error: unknown) {
          const message =
            error instanceof Error ? error.message : String(error);
          const stack = error instanceof Error ? error.stack : undefined;
          this.logger.error(
            `푸시 알림 청크 전송 실패: userId=${userId}, error=${message}`,
            stack,
          );
        }
      }

      // 7. 전송 결과 로깅
      for (const ticket of tickets) {
        if (ticket.status === 'error') {
          this.logger.error(
            `푸시 알림 전송 오류: userId=${userId}, message=${String(
              ticket.message ?? '',
            )}, details=${JSON.stringify(ticket.details)}`,
          );
        } else {
          this.logger.log(
            `푸시 알림 전송 성공: userId=${userId}, id=${String(
              ticket.id ?? '',
            )}`,
          );
        }
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `푸시 알림 전송 중 예외 발생: userId=${userId}, error=${message}`,
        stack,
      );
      throw error instanceof Error ? error : new Error(message);
    }
  }

  /**
   * 읽지 않은 알림 개수를 반환합니다.
   * @param userId 사용자 ID
   * @returns 읽지 않은 알림 개수
   */
  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationRepository.count({
      where: { userId, isRead: false },
    });
  }
}
