import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { MulterFile } from '../../media/types/multer-file.interface';

export class TextBlockDto {
  @IsInt()
  @Min(0)
  order: number;

  @IsString()
  @MaxLength(500)
  content: string;
}

export class CreateCapsuleDto {
  @IsString()
  @MaxLength(100)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  content?: string;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  @ApiPropertyOptional({
    description: '위도. 이스터에그 생성 시 필수입니다.',
    type: Number,
    example: 37.5665,
  })
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  @ApiPropertyOptional({
    description: '경도. 이스터에그 생성 시 필수입니다.',
    type: Number,
    example: 126.978,
  })
  longitude?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUUID('all', { each: true })
  @ApiPropertyOptional({
    description: '미디어 ID 배열 (기존 방식 호환용, 선택적)',
    type: [String],
    example: ['550e8400-e29b-41d4-a716-446655440000'],
  })
  media_ids?: string[];

  @IsOptional()
  @ApiPropertyOptional({
    description: '미디어 파일 배열 (form-data: media_files)',
    type: 'array',
    items: {
      type: 'string',
      format: 'binary',
    },
  })
  media_files?: MulterFile[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => TextBlockDto)
  text_blocks?: TextBlockDto[];

  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({
    description: '타임캡슐 전용 필드 (이스터에그에서는 사용하지 않음)',
    deprecated: true,
  })
  open_at?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @ApiPropertyOptional({
    description: '선착순 인원 제한 (0이면 무제한)',
  })
  view_limit?: number;

  @IsOptional()
  @IsUUID()
  @ApiPropertyOptional({
    description: '레거시 상품 ID (이스터에그에 저장되지 않음)',
    deprecated: true,
  })
  product_id?: string;
}
