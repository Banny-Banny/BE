import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

const toBoolean = ({ value }: { value: any }) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true' || value === '1';
  }
  return false;
};

export class GetCapsulesListQueryDto {
  @Type(() => Number)
  @IsNumber()
  lat: number;

  @Type(() => Number)
  @IsNumber()
  lng: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(10)
  @Max(5000)
  radius_m?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  include_locationless?: boolean;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  include_consumed?: boolean;
}

