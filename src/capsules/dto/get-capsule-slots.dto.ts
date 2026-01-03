import { ApiProperty } from '@nestjs/swagger';

/**
 * 남은 캡슐 슬롯 조회 응답 DTO
 */
export class GetCapsuleSlotsResponseDto {
  @ApiProperty({
    description: '사용자가 보유한 전체 슬롯 개수 (기본 3개 + 추가 구매분)',
    example: 10,
    type: Number,
  })
  totalSlots: number;

  @ApiProperty({
    description: '현재 생성된 캡슐 개수 (활성 상태)',
    example: 5,
    type: Number,
  })
  usedSlots: number;

  @ApiProperty({
    description: '생성 가능한 남은 슬롯 개수',
    example: 5,
    type: Number,
  })
  remainingSlots: number;
}
