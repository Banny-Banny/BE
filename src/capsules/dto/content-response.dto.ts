import { ApiProperty } from '@nestjs/swagger';

export class ContentDataDto {
  @ApiProperty({ description: '사용자 ID' })
  user_id: string;

  @ApiProperty({ description: '닉네임' })
  nickname: string;

  @ApiProperty({ description: '상태', example: 'COMPLETED' })
  status: string;

  @ApiProperty({ description: '저장 시간' })
  saved_at: Date;

  @ApiProperty({ description: '업로드된 이미지 개수' })
  uploaded_images: number;

  @ApiProperty({ description: '음성 업로드 여부' })
  uploaded_music: boolean;

  @ApiProperty({ description: '동영상 업로드 여부' })
  uploaded_video: boolean;
}

export class ContentResponseDto {
  @ApiProperty({ description: '성공 여부' })
  success: boolean;

  @ApiProperty({ description: '응답 데이터', type: ContentDataDto })
  data: ContentDataDto;
}
