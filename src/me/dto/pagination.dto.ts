import { IsInt, Min, Max, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * 페이지네이션 쿼리 DTO
 * 목록 조회 시 페이지네이션을 위한 공통 DTO
 */
export class PaginationQueryDto {
  @ApiPropertyOptional({
    description: '한 페이지에 표시할 아이템 수',
    minimum: 1,
    maximum: 100,
    default: 20,
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: '건너뛸 아이템 수 (페이지 번호 * limit)',
    minimum: 0,
    default: 0,
    example: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}

/**
 * 페이지네이션 응답 메타데이터
 */
export interface PaginationMeta {
  total: number;
  limit: number;
  offset: number;
}

/**
 * 페이지네이션 응답 DTO (제네릭)
 */
export class PaginatedResponseDto<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;

  constructor(items: T[], total: number, limit: number, offset: number) {
    this.items = items;
    this.total = total;
    this.limit = limit;
    this.offset = offset;
  }
}
