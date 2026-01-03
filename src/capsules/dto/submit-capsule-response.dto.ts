import { ApiProperty } from '@nestjs/swagger';

export class LocationDto {
  @ApiProperty({ description: '위도' })
  latitude: number;

  @ApiProperty({ description: '경도' })
  longitude: number;

  @ApiProperty({ description: '주소 (향후 구현)', required: false })
  address?: string;
}

export class SubmitCapsuleDataDto {
  @ApiProperty({ description: '캡슐 ID' })
  capsule_id: string;

  @ApiProperty({ description: '상태', example: 'BURIED' })
  status: string;

  @ApiProperty({ description: '매장 위치', type: LocationDto })
  location: LocationDto;

  @ApiProperty({ description: '매장 시각' })
  buried_at: Date;

  @ApiProperty({ description: '개봉 예정일' })
  open_date: Date;

  @ApiProperty({ description: '참여자 수' })
  participants: number;

  @ApiProperty({ description: '자동 제출 여부' })
  is_auto_submitted: boolean;
}

export class SubmitCapsuleResponseDto {
  @ApiProperty({ description: '성공 여부' })
  success: boolean;

  @ApiProperty({ description: '응답 데이터', type: SubmitCapsuleDataDto })
  data: SubmitCapsuleDataDto;
}
