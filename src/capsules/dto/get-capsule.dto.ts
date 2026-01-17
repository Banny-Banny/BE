import { Type } from 'class-transformer';
import { IsUUID, IsOptional, IsNumber, Min, Max } from 'class-validator';

export class GetCapsuleParamDto {
  @IsUUID()
  id: string;
}

export class GetCapsuleQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;
}
