import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

/**
 * 온보딩 완료 요청 DTO
 */
export class CompleteOnboardingDto {
  @ApiProperty({
    description: '친구 연동 동의 여부 (UI상 동의 클릭 시 true)',
    example: true,
  })
  @IsBoolean()
  friend_consent: boolean;

  @ApiProperty({
    description: '실제 디바이스 위치 권한 허용 여부 (허용 시 true)',
    example: true,
  })
  @IsBoolean()
  location_consent: boolean;
}
