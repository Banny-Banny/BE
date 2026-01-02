import { ApiProperty } from '@nestjs/swagger';

/**
 * 이스터에그 조회자 정보
 */
export class ViewerDto {
  @ApiProperty({
    description: '조회자 ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: '조회자 닉네임',
    example: '김철수',
  })
  nickname: string;

  @ApiProperty({
    description: '조회자 프로필 이미지 URL',
    example: 'https://example.com/profile.jpg',
    nullable: true,
  })
  profile_img: string | null;

  @ApiProperty({
    description: '조회 시각',
    example: '2025-01-02T10:30:00.000Z',
  })
  viewed_at: Date;
}

/**
 * 이스터에그 조회자 목록 응답
 */
export class GetViewersResponseDto {
  @ApiProperty({
    description: '캡슐 ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  capsule_id: string;

  @ApiProperty({
    description: '총 조회자 수',
    example: 3,
  })
  total_viewers: number;

  @ApiProperty({
    description: '조회 제한 수 (0이면 무제한)',
    example: 10,
  })
  view_limit: number;

  @ApiProperty({
    description: '조회자 목록 (조회 시각 오름차순)',
    type: [ViewerDto],
  })
  viewers: ViewerDto[];
}

