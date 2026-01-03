import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, Max, Min } from 'class-validator';

/**
 * 이스터에그 발견 기록 요청
 * (선택적으로 사용자 위치를 함께 기록)
 */
export class RecordViewerDto {
  @ApiProperty({
    description: '조회 시 사용자의 위도 (선택)',
    example: 37.5665,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @ApiProperty({
    description: '조회 시 사용자의 경도 (선택)',
    example: 126.978,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;
}
