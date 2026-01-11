import { ApiProperty } from '@nestjs/swagger';

/**
 * 온보딩 완료 응답 DTO
 */
export class OnboardingResponseDto {
  @ApiProperty({
    description: '성공 여부',
    example: true,
  })
  success: boolean;
}
