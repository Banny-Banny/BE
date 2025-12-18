import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { MediaType } from '../../common/enums';

export class PresignMediaDto {
  @IsEnum(MediaType)
  type: MediaType;

  @IsString()
  @IsNotEmpty()
  filename: string;

  @IsString()
  @IsNotEmpty()
  content_type: string;

  @IsNumber()
  @Min(1)
  // 500MB 상한 방어 (실제 제한은 타입별 별도 적용)
  @Max(500 * 1024 * 1024)
  size: number;
}
