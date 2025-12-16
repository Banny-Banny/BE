import {
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
  ArrayMaxSize,
} from 'class-validator';
import { MediaType } from '../../common/enums';

export class CreateCapsuleDto {
  @IsString()
  @MaxLength(500)
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
