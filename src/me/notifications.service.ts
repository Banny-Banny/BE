import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, Notification } from '../entities';
import {
  NotificationItemDto,
  PaginatedNotificationResponseDto,
  UnreadCountResponseDto,
} from './dto/notification-response.dto';
import {
  SendNotificationDto,
  SendNotificationResponseDto,
  NotificationTargetType,
} from './dto/send-notification.dto';

/**
 * 알림 관리 서비스
 * 알림 조회, 읽음 처리, 발송 기능 제공
 */
@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * 알림 목록 조회
   * @param userId 사용자 ID
   * @param limit 페이지당 아이템 수
   * @param offset 건너뛸 아이템 수
   * @returns 알림 목록 (페이지네이션)
   */
  async getNotifications(
    userId: string,
    limit: number = 20,
    offset: number = 0,
  ): Promise<PaginatedNotificationResponseDto> {
    const [notifications, total] =
      await this.notificationRepository.findAndCount({
        where: { userId },
        order: { createdAt: 'DESC' },
        skip: offset,
        take: limit,
      });

    const notificationItems = notifications.map(
      (notification) =>
        new NotificationItemDto({
          id: notification.id,
          title: notification.title,
          content: notification.content,
          type: notification.type,
          isRead: notification.isRead,
          createdAt: notification.createdAt,
        }),
    );

    return new PaginatedNotificationResponseDto(
      notificationItems,
      total,
      limit,
      offset,
    );
  }

  /**
   * 읽지 않은 알림 개수 조회
   * @param userId 사용자 ID
   * @returns 읽지 않은 알림 개수
   */
  async getUnreadCount(userId: string): Promise<UnreadCountResponseDto> {
    const count = await this.notificationRepository.count({
      where: { userId, isRead: false },
    });

    return new UnreadCountResponseDto(count);
  }

  /**
   * 알림 읽음 처리
   * @param userId 사용자 ID
   * @param notificationId 알림 ID
   */
  async markAsRead(userId: string, notificationId: string): Promise<void> {
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new NotFoundException('알림을 찾을 수 없습니다.');
    }

    // userId 권한 확인
    if (notification.userId !== userId) {
      throw new ForbiddenException('이 알림을 읽음 처리할 권한이 없습니다.');
    }

    // 이미 읽음 상태면 그대로 반환 (멱등성)
    if (notification.isRead) {
      return;
    }

    notification.isRead = true;
    await this.notificationRepository.save(notification);
  }

  /**
   * 알림 삭제
   * @param userId 사용자 ID
   * @param notificationId 알림 ID
   */
  async deleteNotification(
    userId: string,
    notificationId: string,
  ): Promise<void> {
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new NotFoundException('알림을 찾을 수 없습니다.');
    }

    // userId 권한 확인
    if (notification.userId !== userId) {
      throw new ForbiddenException('이 알림을 삭제할 권한이 없습니다.');
    }

    await this.notificationRepository.remove(notification);
  }

  /**
   * 알림 발송 (관리자 전용)
   * @param dto 알림 발송 요청 데이터
   * @returns 알림 발송 응답
   */
  async sendNotification(
    dto: SendNotificationDto,
  ): Promise<SendNotificationResponseDto> {
    if (dto.targetType === NotificationTargetType.USER) {
      // 단일 사용자 대상
      if (!dto.userId) {
        throw new Error('targetType이 USER일 때 userId는 필수입니다.');
      }

      const user = await this.userRepository.findOne({
        where: { id: dto.userId },
      });

      if (!user) {
        throw new NotFoundException('대상 사용자를 찾을 수 없습니다.');
      }

      const notification = this.notificationRepository.create({
        userId: dto.userId,
        title: dto.title,
        content: dto.content,
        type: dto.type,
      });

      await this.notificationRepository.save(notification);

      return new SendNotificationResponseDto('알림이 발송되었습니다.', 1);
    } else {
      // 전체 사용자 대상
      const activeUsers = await this.userRepository.find({
        where: { isActive: true },
        select: ['id'],
      });

      if (activeUsers.length === 0) {
        return new SendNotificationResponseDto(
          '발송할 대상 사용자가 없습니다.',
          0,
        );
      }

      // Bulk insert (batch to avoid parameter limit)
      const notifications = activeUsers
        .map((user) => user.id)
        .filter(Boolean)
        .map((userId) => ({
          userId,
          title: dto.title,
          content: dto.content,
          type: dto.type,
        }));
      const chunkSize = 500;
      for (let i = 0; i < notifications.length; i += chunkSize) {
        const chunk = notifications.slice(i, i + chunkSize);
        await this.notificationRepository.save(chunk);
      }

      return new SendNotificationResponseDto(
        `알림이 ${activeUsers.length}명에게 발송되었습니다.`,
        activeUsers.length,
      );
    }
  }
}
