import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MediaItemDto {
  @ApiProperty({ description: '미디어 ID' })
  media_id: string;

  @ApiProperty({ description: '미디어 URL' })
  url: string;

  @ApiPropertyOptional({ description: '순서 (이미지만 해당)' })
  order?: number;
}

export class GetMyContentDataDto {
  @ApiProperty({ description: '슬롯 ID' })
  slot_id: string;

  @ApiProperty({ description: '사용자 ID' })
  user_id: string;

  @ApiPropertyOptional({ description: '작성한 텍스트 내용' })
  text_message: string | null;

  @ApiProperty({ description: '작성 상태', example: 'COMPLETED' })
  status: 'PENDING' | 'COMPLETED';

  @ApiPropertyOptional({
    description: '이미지 목록',
    type: [MediaItemDto],
  })
  images: MediaItemDto[];

  @ApiPropertyOptional({
    description: '음악',
    type: MediaItemDto,
  })
  music: MediaItemDto | null;

  @ApiPropertyOptional({
    description: '비디오',
    type: MediaItemDto,
  })
  video: MediaItemDto | null;

  @ApiProperty({ description: '생성 시간' })
  created_at: Date;

  @ApiProperty({ description: '수정 시간' })
  updated_at: Date;
}

export class GetMyContentResponseDto {
  @ApiProperty({ description: '성공 여부', example: true })
  success: boolean;

  @ApiProperty({
    description: '콘텐츠 데이터',
    type: GetMyContentDataDto,
  })
  data: GetMyContentDataDto;
}
