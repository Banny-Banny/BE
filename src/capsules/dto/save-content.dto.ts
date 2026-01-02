import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class SaveContentDto {
  @ApiProperty({
    description: '텍스트 메시지',
    example: '안녕하세요! 오늘 정말 행복한 하루였어요.',
  })
  @IsString()
  @IsNotEmpty({ message: '텍스트 메시지는 필수입니다' })
  text_message: string;

  @ApiPropertyOptional({
    description: '초대 코드 (선택)',
    example: 'ABC123',
  })
  @IsString()
  @IsOptional()
  invite_code?: string;

  @ApiPropertyOptional({
    type: 'array',
    items: { type: 'string', format: 'binary' },
    description: '이미지 파일 (최대 5개)',
  })
  @IsOptional()
  images?: any;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: '음성 파일',
  })
  @IsOptional()
  music?: any;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: '동영상 파일',
  })
  @IsOptional()
  video?: any;
}
