import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
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
import { MediaType } from '../../common/enums';

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
    description: '미디어 ID 배열. /api/media/upload 또는 /api/media/complete로 업로드 완료 후 받은 media_id 사용',
    required: false,
    type: [String],
    example: ['550e8400-e29b-41d4-a716-446655440000'],
  })
  media_ids?: string[];

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
