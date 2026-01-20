import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

export class AdminUserTrendsQueryDto {
  @ApiPropertyOptional({ enum: ['90d'], default: '90d' })
  @IsOptional()
  @IsIn(['90d'])
  period = '90d' as const;
}
