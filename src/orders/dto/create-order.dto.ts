import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
  IsDateString,
  IsString,
  MaxLength,
} from 'class-validator';
import { TimeOption } from '../../common/enums';

export class CreateOrderDto {
  @IsUUID()
  product_id: string;

  @IsEnum(TimeOption)
  time_option: TimeOption;

  @IsOptional()
  @IsDateString()
  custom_open_at?: string;

  @IsInt()
  @Min(1)
  @Max(10)
  headcount: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  photo_count?: number;

  @IsOptional()
  @IsBoolean()
  add_music?: boolean;

  @IsOptional()
  @IsBoolean()
  add_video?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(100, { message: '타임캡슐 제목은 최대 100자까지 가능합니다' })
  capsule_title?: string;
}
