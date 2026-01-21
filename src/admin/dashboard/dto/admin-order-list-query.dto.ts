import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { OrderStatus, PaymentStatus } from '../../../common/enums';

export class AdminOrderListQueryDto {
  @ApiPropertyOptional({
    description: '주문 상태',
    enum: [...Object.values(OrderStatus), 'ALL'],
    default: 'ALL',
  })
  @IsOptional()
  @IsIn([...Object.values(OrderStatus), 'ALL'])
  status?: OrderStatus | 'ALL' = 'ALL';

  @ApiPropertyOptional({
    description: '결제 상태',
    enum: [...Object.values(PaymentStatus), 'ALL'],
    default: 'ALL',
  })
  @IsOptional()
  @IsIn([...Object.values(PaymentStatus), 'ALL'])
  paymentStatus?: PaymentStatus | 'ALL' = 'ALL';

  @ApiPropertyOptional({ description: '유저 ID (UUID 형식)' })
  @IsOptional()
  @IsUUID('4')
  userId?: string;

  @ApiPropertyOptional({
    description: '유저 검색 (닉네임 또는 이메일)',
    example: '초롱 또는 user@example.com',
  })
  @IsOptional()
  @IsString()
  userSearch?: string;

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

