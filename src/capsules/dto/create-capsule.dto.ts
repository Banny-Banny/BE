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
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @IsString({ each: true })
  media_urls?: (string | null)[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @IsEnum(MediaType, { each: true })
  media_types?: (MediaType | null)[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUUID('all', { each: true })
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
