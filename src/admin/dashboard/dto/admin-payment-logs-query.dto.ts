import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { PaymentStatus } from '../../../common/enums';

export class AdminPaymentLogsQueryDto {
  @ApiPropertyOptional({
    description: '결제 상태',
    enum: [...Object.values(PaymentStatus), 'ALL'],
    default: 'ALL',
  })
  @IsOptional()
  @IsIn([...Object.values(PaymentStatus), 'ALL'])
  status?: PaymentStatus | 'ALL' = 'ALL';

  @ApiPropertyOptional({ description: '유저 ID' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-01-31' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}
