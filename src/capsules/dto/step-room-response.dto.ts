import { ApiProperty } from '@nestjs/swagger';

/**
 * 초대 코드로 대기실 조회 시 응답 DTO
 * GET /api/capsules/step-rooms?invite_code={code}
 */
export class StepRoomResponseDto {
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
    description: '열람 날짜 (캡슐이 열리는 날)',
    example: '2026-01-16T00:00:00.000Z',
  })
  open_date: Date;

  @ApiProperty({
    description: '마감시한 (작성 완료 기한, 결제 시각 + 24시간)',
    example: '2025-12-31T13:00:00.000Z',
  })
  deadline: Date;

  @ApiProperty({
    description: '전체 인원수 (주문 시 선택한 headcount)',
    example: 3,
  })
  participant_count: number;

  @ApiProperty({
    description: '현재 참여 인원 (슬롯이 배정된 사용자 수)',
    example: 1,
  })
  current_participants: number;

  @ApiProperty({
    description: '대기실 상태',
    enum: ['WAITING', 'COMPLETED', 'EXPIRED'],
    example: 'WAITING',
  })
  status: string;

  @ApiProperty({
    description: '참여 가능 여부 (deadline 경과, 인원 마감, 상태 확인)',
    example: true,
  })
  is_joinable: boolean;
}

/**
 * 참여 슬롯 정보 DTO
 * 각 참여자가 배정받은 슬롯
 */
export class SlotDto {
  @ApiProperty({
    description: '슬롯 번호 (1부터 시작)',
    example: 1,
  })
  slot_number: number;

  @ApiProperty({
    description: '배정된 사용자 ID (null이면 초대 대기)',
    example: '550e8400-e29b-41d4-a716-446655440001',
    nullable: true,
  })
  user_id: string | null;

  @ApiProperty({
    description: '방장 여부 (첫 번째 슬롯은 주문자가 방장)',
    example: true,
  })
  is_host: boolean;

  @ApiProperty({
    description: '슬롯 상태 (PENDING: 초대 대기, ACCEPTED: 참여 확정)',
    enum: ['PENDING', 'ACCEPTED'],
    example: 'ACCEPTED',
  })
  status: string;

  @ApiProperty({
    description: '사용자 닉네임 (배정되지 않으면 null)',
    example: '김동은',
    nullable: true,
  })
  nickname: string | null;

  @ApiProperty({
    description:
      '콘텐츠 작성 완료 여부 (해당 슬롯 사용자가 콘텐츠를 제출했는지 여부)',
    example: true,
  })
  has_content: boolean;
}

/**
 * 대기실 상세 정보 응답 DTO (참여자 전용)
 * GET /api/capsules/step-rooms/:capsuleId
 */
export class StepRoomDetailDto {
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
    description: '열람 날짜',
    example: '2026-01-16T00:00:00.000Z',
  })
  open_date: Date;

  @ApiProperty({
    description: '마감시한',
    example: '2025-12-31T13:00:00.000Z',
  })
  deadline: Date;

  @ApiProperty({
    description: '대기실 상태',
    enum: ['WAITING', 'COMPLETED', 'EXPIRED'],
    example: 'WAITING',
  })
  status: string;

  @ApiProperty({
    description: '참여 슬롯 목록 (모든 참여자 정보)',
    type: [SlotDto],
    example: [
      {
        slot_number: 1,
        user_id: '550e8400-e29b-41d4-a716-446655440001',
        is_host: true,
        status: 'ACCEPTED',
        nickname: '김동은',
        has_content: true,
      },
      {
        slot_number: 2,
        user_id: null,
        is_host: false,
        status: 'PENDING',
        nickname: null,
        has_content: false,
      },
    ],
  })
  slots: SlotDto[];
}
