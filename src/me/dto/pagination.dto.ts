import { IsInt, Min, Max, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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
  @ApiProperty({
    description: '아이템 목록',
  })
  items: T[];

  @ApiProperty({
    description: '전체 아이템 수',
    example: 157,
  })
  total: number;

  @ApiProperty({
    description: '현재 limit 값',
    example: 20,
  })
  limit: number;

  @ApiProperty({
    description: '현재 offset 값',
    example: 0,
  })
  offset: number;

  @ApiPropertyOptional({
    description: '다음 페이지 존재 여부',
    example: true,
  })
  hasNext?: boolean;

  constructor(items: T[], total: number, limit: number, offset: number) {
    this.items = items;
    this.total = total;
    this.limit = limit;
    this.offset = offset;
    this.hasNext = offset + items.length < total;
  }
}
