import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CompleteMediaDto {
  @IsString()
  @IsNotEmpty()
  object_key: string;

  @IsString()
  @IsNotEmpty()
  content_type: string;

  @IsNumber()
  @Min(1)
  size: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  duration_ms?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  width?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  height?: number;
}

