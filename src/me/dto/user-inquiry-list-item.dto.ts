import { ApiProperty } from '@nestjs/swagger';
import { InquiryStatus } from '../../common/enums';

export class UserInquiryListItemDto {
  @ApiProperty({
    description: '문의(채팅방) ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: '문의 상태',
    enum: InquiryStatus,
    example: InquiryStatus.PENDING,
  })
  status: InquiryStatus;

  @ApiProperty({
    description: '해결 여부',
    example: false,
  })
  isResolved: boolean;

  @ApiProperty({
    description: '문의 제목',
    example: '1:1 문의',
  })
  title: string;

  @ApiProperty({
    description: '마지막 메시지 시간',
    example: '2026-01-20T10:30:00.000Z',
    nullable: true,
  })
  lastMessageAt: Date | null;

  @ApiProperty({
    description: '마지막 메시지 미리보기',
    example: '문의가 시작되었습니다.',
    nullable: true,
  })
  lastMessagePreview: string | null;

  @ApiProperty({
    description: '읽지 않은 관리자 메시지 수',
    example: 2,
  })
  unreadCount: number;

  @ApiProperty({
    description: '문의 생성일',
    example: '2026-01-19T09:00:00.000Z',
  })
  createdAt: Date;

  constructor(partial: Partial<UserInquiryListItemDto>) {
    Object.assign(this, partial);
  }
}
