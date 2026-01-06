import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { MulterFile } from '../../media/types/multer-file.interface';

export class CreateCapsuleEntryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  @ApiProperty({
    description: '작성 내용',
    required: true,
    type: String,
    example: '안녕하세요, 타임캡슐 내용입니다.',
  })
  content: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @IsUUID('all', { each: true })
  @ApiProperty({
    description: '미디어 ID 배열 (기존 방식 호환용, 선택적)',
    required: false,
    type: [String],
    example: ['550e8400-e29b-41d4-a716-446655440000'],
  })
  media_item_ids?: string[];

  @ApiProperty({
    description: '미디어 파일 배열 (form-data: media_files)',
    required: false,
    type: 'array',
    items: {
      type: 'string',
      format: 'binary',
    },
  })
  media_files?: MulterFile[];
}
