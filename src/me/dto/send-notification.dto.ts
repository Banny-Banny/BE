import { IsString, IsEnum, IsOptional, IsUUID, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationType } from '../../common/enums';

/**
 * 알림 발송 대상 타입
 */
export enum NotificationTargetType {
  USER = 'USER', // 특정 사용자
  ALL = 'ALL', // 전체 사용자
}

/**
 * 알림 발송 요청 DTO (관리자 전용)
 * POST /api/admin/notifications 요청 바디
 */
export class SendNotificationDto {
  @ApiProperty({
    description: '발송 대상 타입',
    enum: NotificationTargetType,
    example: NotificationTargetType.USER,
  })
  @IsEnum(NotificationTargetType)
  targetType: NotificationTargetType;

  @ApiPropertyOptional({
    description: '대상 사용자 ID (targetType이 USER일 때 필수)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID('4', { message: '올바른 사용자 ID 형식이 아닙니다.' })
  userId?: string;

  @ApiProperty({
    description: '알림 제목 (최대 100자)',
    example: '시스템 공지',
  })
  @IsString()
  @Length(1, 100, { message: '알림 제목은 1-100자 사이여야 합니다.' })
  title: string;

  @ApiProperty({
    description: '알림 내용 (최대 1000자)',
    example: '서비스 점검이 예정되어 있습니다.',
  })
  @IsString()
  @Length(1, 1000, { message: '알림 내용은 1-1000자 사이여야 합니다.' })
  content: string;

  @ApiProperty({
    description: '알림 타입',
    enum: NotificationType,
    example: NotificationType.SYSTEM,
  })
  @IsEnum(NotificationType)
  type: NotificationType;
}

/**
 * 알림 발송 응답 DTO
 */
export class SendNotificationResponseDto {
  @ApiProperty({
    description: '응답 메시지',
    example: '알림이 발송되었습니다.',
  })
  message: string;

  @ApiProperty({
    description: '발송된 알림 개수',
    example: 1,
  })
  count: number;

  constructor(message: string, count: number) {
    this.message = message;
    this.count = count;
  }
}
