import { ApiProperty } from '@nestjs/swagger';

/**
 * 타임캡슐(대기실) 생성 응답 DTO
 */
export class CreateStepRoomResponseDto {
  @ApiProperty({
    description: '생성된 캡슐(대기실) ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  capsule_id: string;

  @ApiProperty({
    description: '대기실 초대 코드 (6자리)',
    example: 'ABC123',
  })
  invite_code: string;

  @ApiProperty({
    description: '캡슐 제목',
    example: '나의 타임캡슐',
  })
  title: string;

  @ApiProperty({
    description: '개봉 예정일',
    example: '2025-01-12T10:30:00.000Z',
  })
  open_date: Date;

  @ApiProperty({
    description: '대기실 마감 시한 (결제 완료 + 24시간)',
    example: '2025-01-06T10:30:00.000Z',
  })
  deadline: Date;

  @ApiProperty({
    description: '최대 참여 인원',
    example: 4,
  })
  max_participants: number;

  @ApiProperty({
    description: '현재 참여 인원 (생성 시점에는 1)',
    example: 1,
  })
  current_participants: number;

  @ApiProperty({
    description: '대기실 상태',
    example: 'WAITING',
    enum: ['WAITING', 'COMPLETED', 'EXPIRED', 'BURIED'],
  })
  status: string;

  @ApiProperty({
    description: '생성 시각',
    example: '2025-01-05T10:30:00.000Z',
  })
  created_at: Date;
}
