import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';

/**
 * 대기실 참여 요청 DTO
 * POST /api/capsules/step-rooms/:capsuleId/join
 */
export class JoinStepRoomDto {
  @ApiProperty({
    description: '초대 코드 (6자리 영숫자)',
    example: 'ABC123',
    minLength: 6,
    maxLength: 6,
  })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  invite_code: string;
}

/**
 * 대기실 참여 성공 응답 DTO
 */
export class JoinStepRoomResponseDto {
  @ApiProperty({
    description: '성공 여부',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: '대기실(캡슐) ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  room_id: string;

  @ApiProperty({
    description: '배정된 슬롯 번호 (1부터 시작)',
    example: 2,
  })
  slot_number: number;

  @ApiProperty({
    description: '참여자 닉네임',
    example: '김철수',
  })
  nickname: string;

  @ApiProperty({
    description: '참여 시각',
    example: '2025-01-07T10:30:00.000Z',
  })
  joined_at: Date;
}
