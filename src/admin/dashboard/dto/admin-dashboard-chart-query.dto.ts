import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsDateString } from 'class-validator';

export class AdminDashboardChartQueryDto {
  @ApiPropertyOptional({ enum: ['day', 'week', 'month'], default: 'day' })
  @IsOptional()
  @IsIn(['day', 'week', 'month'])
  period?: 'day' | 'week' | 'month' = 'day';

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-01-31' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
