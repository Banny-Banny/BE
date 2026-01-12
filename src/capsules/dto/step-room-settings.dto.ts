import { ApiProperty } from '@nestjs/swagger';

/**
 * 대기실 설정값 조회 응답 DTO
 * GET /api/capsules/step-rooms/:capsuleId/settings
 */
export class StepRoomSettingsResponseDto {
  @ApiProperty({
    description: '대기실(캡슐) ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  room_id: string;

  @ApiProperty({
    description: '캡슐 이름',
    example: '강동구 물주먹들👊',
  })
  capsule_name: string;

  @ApiProperty({
    description: '열람 날짜 (YYYY-MM-DD)',
    example: '2026-01-16',
  })
  open_date: string;

  @ApiProperty({
    description: '최대 참여 인원',
    example: 4,
  })
  max_participants: number;

  @ApiProperty({
    description: '1인당 최대 사진 개수',
    example: 3,
  })
  max_images_per_person: number;

  @ApiProperty({
    description: '음성 업로드 가능 여부',
    example: true,
  })
  has_music: boolean;

  @ApiProperty({
    description: '동영상 업로드 가능 여부',
    example: true,
  })
  has_video: boolean;

  @ApiProperty({
    description: '대기실 초대 코드 (6자리)',
    example: 'R2Q6VZ',
  })
  invite_code: string;
}
