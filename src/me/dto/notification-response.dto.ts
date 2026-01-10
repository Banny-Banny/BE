import { ApiProperty } from '@nestjs/swagger';
import { NotificationType } from '../../common/enums';
import { PaginatedResponseDto } from './pagination.dto';

/**
 * 알림 아이템 DTO
 */
export class NotificationItemDto {
  @ApiProperty({
    description: '알림 ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: '알림 제목',
    example: '타임캡슐이 오픈되었습니다',
  })
  title: string;

  @ApiProperty({
    description: '알림 내용',
    example: '2024년 추억 캡슐이 오픈되었습니다. 지금 확인해보세요!',
  })
  content: string;

  @ApiProperty({
    description: '알림 타입',
    enum: NotificationType,
    example: NotificationType.CAPSULE_OPEN,
  })
  type: NotificationType;

  @ApiProperty({
    description: '읽음 여부',
    example: false,
  })
  isRead: boolean;

  @ApiProperty({
    description: '알림 생성일',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt: Date;

  constructor(data: {
    id: string;
    title: string;
    content: string;
    type: NotificationType;
    isRead: boolean;
    createdAt: Date;
  }) {
    Object.assign(this, data);
  }
}

/**
 * 알림 목록 응답 DTO (페이지네이션)
 */
export class PaginatedNotificationResponseDto extends PaginatedResponseDto<NotificationItemDto> {
  @ApiProperty({
    description: '알림 목록',
    type: [NotificationItemDto],
  })
  declare items: NotificationItemDto[];

  constructor(
    items: NotificationItemDto[],
    total: number,
    limit: number,
    offset: number,
  ) {
    super(items, total, limit, offset);
  }
}

/**
 * 읽지 않은 알림 개수 응답 DTO
 */
export class UnreadCountResponseDto {
  @ApiProperty({
    description: '읽지 않은 알림 개수',
    example: 5,
  })
  count: number;

  constructor(count: number) {
    this.count = count;
  }
}

