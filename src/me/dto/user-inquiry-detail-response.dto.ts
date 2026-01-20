import { ApiProperty } from '@nestjs/swagger';
import { InquiryStatus } from '../../common/enums';
import { UserInquiryMessageDto } from './user-inquiry-message.dto';

export class UserInquiryDetailDto {
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
    description: '문의 생성일',
    example: '2026-01-19T09:00:00.000Z',
  })
  createdAt: Date;

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

  constructor(partial: Partial<UserInquiryDetailDto>) {
    Object.assign(this, partial);
  }
}

export class UserInquiryDetailResponseDto {
  @ApiProperty({
    description: '문의 메타 정보',
    type: UserInquiryDetailDto,
  })
  inquiry: UserInquiryDetailDto;

  @ApiProperty({
    description: '메시지 목록',
    type: [UserInquiryMessageDto],
  })
  messages: UserInquiryMessageDto[];

  @ApiProperty({
    description: '전체 메시지 수',
    example: 120,
  })
  total: number;

  @ApiProperty({
    description: '현재 limit 값',
    example: 20,
  })
  limit: number;

  @ApiProperty({
    description: '현재 offset 값',
    example: 0,
  })
  offset: number;

  @ApiProperty({
    description: '다음 페이지 존재 여부',
    example: true,
  })
  hasNext: boolean;

  constructor(params: {
    inquiry: UserInquiryDetailDto;
    messages: UserInquiryMessageDto[];
    total: number;
    limit: number;
    offset: number;
  }) {
    this.inquiry = params.inquiry;
    this.messages = params.messages;
    this.total = params.total;
    this.limit = params.limit;
    this.offset = params.offset;
    this.hasNext = params.offset + params.messages.length < params.total;
  }
}
