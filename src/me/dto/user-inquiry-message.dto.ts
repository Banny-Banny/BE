import { ApiProperty } from '@nestjs/swagger';
import { InquirySenderType } from '../../common/enums';

export class UserInquiryMessageDto {
  @ApiProperty({
    description: '메시지 ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: '보낸 사람 타입',
    enum: InquirySenderType,
    example: InquirySenderType.USER,
  })
  senderType: InquirySenderType;

  @ApiProperty({
    description: '유저 ID (유저 메시지일 때만 값 존재)',
    example: '550e8400-e29b-41d4-a716-446655440000',
    nullable: true,
  })
  senderUserId: string | null;

  @ApiProperty({
    description: '관리자 ID (관리자 메시지일 때만 값 존재)',
    example: '550e8400-e29b-41d4-a716-446655440000',
    nullable: true,
  })
  senderAdminId: string | null;

  @ApiProperty({
    description: '메시지 내용',
    example: '문의 드립니다.',
  })
  content: string;

  @ApiProperty({
    description: '관리자 읽음 여부',
    example: true,
  })
  isReadByAdmin: boolean;

  @ApiProperty({
    description: '유저 읽음 여부',
    example: false,
  })
  isReadByUser: boolean;

  @ApiProperty({
    description: '생성일',
    example: '2026-01-20T10:30:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: '수정일',
    example: '2026-01-20T10:31:00.000Z',
  })
  updatedAt: Date;

  constructor(partial: Partial<UserInquiryMessageDto>) {
    Object.assign(this, partial);
  }
}
