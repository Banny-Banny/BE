import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
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
  @ApiProperty({
    description: '위도. 이스터에그 생성 시 필수입니다.',
    required: false,
    type: Number,
    example: 37.5665,
  })
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @ApiProperty({
    description: '경도. 이스터에그 생성 시 필수입니다.',
    required: false,
    type: Number,
    example: 126.978,
  })
  longitude?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUUID('all', { each: true })
  @ApiProperty({
    description: '미디어 ID 배열 (기존 방식 호환용, 선택적)',
    required: false,
    type: [String],
    example: ['550e8400-e29b-41d4-a716-446655440000'],
  })
  media_ids?: string[];

  @IsOptional()
  @ApiProperty({
    description: '미디어 파일 배열 (form-data: media_files)',
    required: false,
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
  open_at?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  view_limit?: number;

  @IsOptional()
  @IsUUID()
  product_id?: string;
}
