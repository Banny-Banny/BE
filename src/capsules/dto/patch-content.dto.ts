import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class PatchContentDto {
  @ApiPropertyOptional({
    description: '텍스트 메시지 (전달된 경우에만 수정)',
    example: '텍스트만 수정합니다.',
  })
  @IsString()
  @IsOptional()
  text_message?: string;

  @ApiPropertyOptional({
    type: 'array',
    items: { type: 'string', format: 'binary' },
    description: '이미지 파일 (전달 시 전체 교체, 최대 5개)',
  })
  @IsOptional()
  images?: any;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: '음성 파일 (전달 시 교체)',
  })
  @IsOptional()
  music?: any;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: '동영상 파일 (전달 시 교체)',
  })
  @IsOptional()
  video?: any;
}
