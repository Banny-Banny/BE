import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
  IsDateString,
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
}

