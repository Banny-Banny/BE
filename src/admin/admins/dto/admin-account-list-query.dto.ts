import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class AdminAccountListQueryDto {
  @ApiPropertyOptional({ description: '검색어(이메일/이름)', example: 'admin' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: ['ALL', 'ACTIVE', 'INACTIVE'],
    default: 'ALL',
  })
  @IsOptional()
  @IsIn(['ALL', 'ACTIVE', 'INACTIVE'])
  status?: 'ALL' | 'ACTIVE' | 'INACTIVE' = 'ALL';

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
