import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateNoticeDto {
  @ApiPropertyOptional({ description: '공지 제목', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ description: '공지 본문' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ description: '공지 이미지 URL' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ description: '상단 고정 여부' })
  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  @ApiPropertyOptional({ description: '노출 여부' })
  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;
}
