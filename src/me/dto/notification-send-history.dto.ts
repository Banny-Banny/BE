import { ApiProperty } from '@nestjs/swagger';
import { NotificationType } from '../../common/enums';

export class NotificationSendHistoryItemDto {
  @ApiProperty({
    description: '메시지 ID (그룹 대표 ID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  messageId: string;

  @ApiProperty({ description: '메시지 제목', example: '공지 제목' })
  title: string;

  @ApiProperty({ description: '메시지 내용', example: '메시지 내용' })
  content: string;

  @ApiProperty({
    description: '발송 시각',
    example: '2026-01-10T15:30:00.000Z',
  })
  sentAt: Date;

  @ApiProperty({ description: '발송 대상 수', example: 120 })
  targetCount: number;

  @ApiProperty({
    description: '알림 타입',
    enum: NotificationType,
    example: NotificationType.SYSTEM,
  })
  type: NotificationType;

  constructor(data: Partial<NotificationSendHistoryItemDto>) {
    Object.assign(this, data);
  }
}

export class PaginatedNotificationSendHistoryResponseDto {
  @ApiProperty({ type: [NotificationSendHistoryItemDto] })
  items: NotificationSendHistoryItemDto[];

  @ApiProperty({ description: '전체 아이템 수', example: 50 })
  total: number;

  @ApiProperty({ description: '현재 limit 값', example: 20 })
  limit: number;

  @ApiProperty({ description: '현재 offset 값', example: 0 })
  offset: number;

  @ApiProperty({ description: '다음 페이지 존재 여부', example: true })
  hasNext: boolean;

  constructor(
    items: NotificationSendHistoryItemDto[],
    total: number,
    limit: number,
    offset: number,
  ) {
    this.items = items;
    this.total = total;
    this.limit = limit;
    this.offset = offset;
    this.hasNext = offset + items.length < total;
  }
}
