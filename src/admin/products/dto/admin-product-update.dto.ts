import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { MediaType } from '../../../common/enums';
import { ProductType } from '../../../entities/product.entity';

export class AdminProductUpdateDto {
  @ApiPropertyOptional({ description: '상품명', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  name?: string;

  @ApiPropertyOptional({ description: '판매 가격', minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({ description: '상품 상세 설명' })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional({ description: '썸네일 URL' })
  @IsOptional()
  @IsUrl()
  thumbnailUrl?: string | null;

  @ApiPropertyOptional({ description: '카테고리 ID' })
  @IsOptional()
  @IsUUID()
  categoryId?: string | null;

  @ApiPropertyOptional({ description: '판매/노출 상태' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: '상품 유형', enum: ProductType })
  @IsOptional()
  @IsEnum(ProductType)
  productType?: ProductType;

  @ApiPropertyOptional({
    description: '허용 미디어 타입 목록 (이스터에그용)',
    enum: MediaType,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(MediaType, { each: true })
  mediaTypes?: MediaType[] | null;

  @ApiPropertyOptional({ description: '업로드 가능한 미디어 최대 개수 (0~3)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(3)
  maxMediaCount?: number | null;
}
