import { IsUUID, IsOptional, IsNumber } from 'class-validator';

export class GetCapsuleParamDto {
  @IsUUID()
  id: string;
}

export class GetCapsuleQueryDto {
  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lng?: number;
}
