import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateNoticeDto {
  @ApiProperty({ description: '공지 제목', maxLength: 200 })
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiProperty({ description: '공지 본문' })
  @IsString()
  content: string;

  @ApiPropertyOptional({ description: '공지 이미지 URL' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ description: '상단 고정 여부', default: false })
  @IsOptional()
  @IsBoolean()
  isPinned?: boolean = false;

  @ApiPropertyOptional({ description: '노출 여부', default: true })
  @IsOptional()
  @IsBoolean()
  isVisible?: boolean = true;
}
