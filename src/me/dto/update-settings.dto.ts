import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * 알림 설정 수정 DTO
 * PATCH /api/me/settings 요청 바디
 */
export class UpdateSettingsDto {
  @ApiPropertyOptional({
    description: '푸시 알림 수신 동의 여부',
    example: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'isPushAgreed는 boolean 타입이어야 합니다.' })
  isPushAgreed?: boolean;

  @ApiPropertyOptional({
    description: '마케팅 알림 수신 동의 여부',
    example: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'isMarketingAgreed는 boolean 타입이어야 합니다.' })
  isMarketingAgreed?: boolean;
}

