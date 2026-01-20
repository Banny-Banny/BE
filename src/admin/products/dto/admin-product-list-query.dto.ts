import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AdminProductListQueryDto {
  @ApiPropertyOptional({ description: '검색어(상품명)', example: '타임캡슐' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: '카테고리 ID',
    example: 'b3f1df7b-6b13-4bf5-b0f8-0f8c3a1b0a01',
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({
    enum: ['ALL', 'ACTIVE', 'INACTIVE', 'DELETED'],
    default: 'ALL',
  })
  @IsOptional()
  @IsIn(['ALL', 'ACTIVE', 'INACTIVE', 'DELETED'])
  status?: 'ALL' | 'ACTIVE' | 'INACTIVE' | 'DELETED' = 'ALL';

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
