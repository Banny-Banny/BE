import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

export class AdminProductCreateDto {
  @ApiProperty({
    description: '상품명',
    maxLength: 50,
    example: '100년 타임캡슐',
  })
  @IsString()
  @MaxLength(50)
  name: string;

  @ApiProperty({ description: '판매 가격', example: 9900, minimum: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  price: number;

  @ApiPropertyOptional({
    description: '상품 상세 설명',
    example: '100년 뒤에 열리는 타임캡슐',
  })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional({
    description: '썸네일 URL',
    example: 'https://cdn.example.com/products/capsule.png',
  })
  @IsOptional()
  @IsUrl()
  thumbnailUrl?: string | null;

  @ApiPropertyOptional({
    description: '카테고리 ID',
    example: 'b3f1df7b-6b13-4bf5-b0f8-0f8c3a1b0a01',
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string | null;

  @ApiPropertyOptional({ description: '판매/노출 상태', example: true })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: '상품 유형',
    enum: ProductType,
    example: ProductType.TIME_CAPSULE,
  })
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

  @ApiPropertyOptional({
    description: '업로드 가능한 미디어 최대 개수 (0~3)',
    minimum: 0,
    maximum: 3,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(3)
  maxMediaCount?: number | null;
}
