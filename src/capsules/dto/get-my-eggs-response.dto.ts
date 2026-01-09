import { ApiProperty } from '@nestjs/swagger';

export class MyEggItemDto {
  @ApiProperty({
    description: '이스터에그 ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  eggId: string;

  @ApiProperty({
    description: '이스터에그 제목',
    example: '응원의 메시지',
  })
  title: string;

  @ApiProperty({
    description: '이스터에그 내용',
    example: '너는 할 수 있어! 항상 응원할게 파이팅!!',
    nullable: true,
  })
  content: string | null;

  @ApiProperty({
    description: '조회수',
    example: 1,
  })
  viewCount: number;

  @ApiProperty({
    description: '위도',
    example: 37.5665,
    nullable: true,
  })
  latitude: number | null;

  @ApiProperty({
    description: '경도',
    example: 126.978,
    nullable: true,
  })
  longitude: number | null;

  @ApiProperty({
    description: '이미지 포함 여부',
    example: true,
  })
  hasImage: boolean;

  @ApiProperty({
    description: '오디오 포함 여부',
    example: true,
  })
  hasAudio: boolean;

  @ApiProperty({
    description: '비디오 포함 여부',
    example: false,
  })
  hasVideo: boolean;

  @ApiProperty({
    description: '이스터에그 생성일 (심은 날짜)',
    example: '2024-12-01T00:00:00.000Z',
  })
  createdDate: Date;

  @ApiProperty({
    description: '상태 (ACTIVE: 활성, EXPIRED: 소멸)',
    example: 'ACTIVE',
    required: false,
  })
  status?: 'ACTIVE' | 'EXPIRED';

  @ApiProperty({
    description: '발견한 날짜 (type=FOUND일 때만)',
    example: '2025-01-05T14:30:00.000Z',
    required: false,
  })
  foundDate?: Date;
}

export class GetMyPlantedEggsResponseDto {
  @ApiProperty({
    description: '요약 정보',
  })
  summary: {
    totalPlantedCount: number;
    activeCount: number;
  };

  @ApiProperty({
    description: '심은 알 데이터',
  })
  data: {
    activeEggs: MyEggItemDto[];
    expiredEggs: MyEggItemDto[];
  };
}

export class GetMyFoundEggsResponseDto {
  @ApiProperty({
    description: '요약 정보',
  })
  summary: {
    totalFoundCount: number;
  };

  @ApiProperty({
    description: '발견한 알 목록',
    type: [MyEggItemDto],
  })
  data: MyEggItemDto[];
}
