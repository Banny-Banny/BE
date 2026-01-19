import { ApiProperty } from '@nestjs/swagger';

export class EggAuthorDto {
  @ApiProperty({
    description: '작성자 ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: '작성자 닉네임',
    example: '김철수',
  })
  nickname: string;

  @ApiProperty({
    description: '작성자 프로필 이미지 URL',
    example: 'https://example.com/profile.jpg',
    nullable: true,
  })
  profileImg: string | null;
}

export class EggViewerDto {
  @ApiProperty({
    description: '방문자 ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  id: string;

  @ApiProperty({
    description: '방문자 닉네임',
    example: '이영희',
  })
  nickname: string;

  @ApiProperty({
    description: '방문자 프로필 이미지 URL',
    example: 'https://example.com/profile2.jpg',
    nullable: true,
  })
  profileImg: string | null;

  @ApiProperty({
    description: '방문 날짜',
    example: '2025-01-05T14:30:00.000Z',
  })
  viewedAt: Date;
}

export class EggLocationDto {
  @ApiProperty({
    description: '주소 (옵션)',
    example: '서울 강남구',
    nullable: true,
  })
  address: string | null;

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
}

export class GetEggDetailResponseDto {
  @ApiProperty({
    description: '알 ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  eggId: string;

  @ApiProperty({
    description: '알 타입 (FOUND: 내가 발견한 알, PLANTED: 내가 심은 알)',
    enum: ['FOUND', 'PLANTED'],
    example: 'FOUND',
  })
  type: 'FOUND' | 'PLANTED';

  @ApiProperty({
    description: '내가 작성자인지 여부 (수정/삭제 버튼 노출 분기용)',
    example: false,
  })
  isMine: boolean;

  @ApiProperty({
    description: '알 제목',
    example: '좋은 하루',
  })
  title: string;

  @ApiProperty({
    description: '메시지 내용',
    example: '오늘도 웃으면서 보내! 넌 최고야',
    nullable: true,
  })
  message: string | null;

  @ApiProperty({
    description: '이미지 Media ID (프론트에서 URL로 변환)',
    example: '550e8400-e29b-41d4-a716-446655440002',
    nullable: true,
  })
  imageMediaId: string | null;

  @ApiProperty({
    description: '이미지 Object Key',
    example: 'media/user-id/IMAGE/uuid.jpg',
    nullable: true,
  })
  imageObjectKey: string | null;

  @ApiProperty({
    description: '오디오 Media ID (프론트에서 URL로 변환)',
    example: '550e8400-e29b-41d4-a716-446655440003',
    nullable: true,
  })
  audioMediaId: string | null;

  @ApiProperty({
    description: '오디오 Object Key',
    example: 'media/user-id/AUDIO/uuid.mp3',
    nullable: true,
  })
  audioObjectKey: string | null;

  @ApiProperty({
    description: '비디오 Media ID (프론트에서 URL로 변환)',
    example: '550e8400-e29b-41d4-a716-446655440004',
    nullable: true,
  })
  videoMediaId: string | null;

  @ApiProperty({
    description: '비디오 Object Key',
    example: 'media/user-id/VIDEO/uuid.mp4',
    nullable: true,
  })
  videoObjectKey: string | null;

  @ApiProperty({
    description: '위치 정보',
    type: EggLocationDto,
  })
  location: EggLocationDto;

  @ApiProperty({
    description: '작성자 정보',
    type: EggAuthorDto,
  })
  author: EggAuthorDto;

  @ApiProperty({
    description: '생성일 (알이 심어진 날짜)',
    example: '2024-11-10T00:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: '발견한 날짜 (type이 FOUND일 때만 존재)',
    example: '2024-12-01T14:30:00.000Z',
    nullable: true,
  })
  foundAt: Date | null;

  @ApiProperty({
    description: '소멸된 날짜 (소멸되지 않았다면 null)',
    example: '2024-11-15T00:00:00.000Z',
    nullable: true,
  })
  expiredAt: Date | null;

  @ApiProperty({
    description: '이 알을 발견한 총 인원 수',
    example: 3,
  })
  discoveredCount: number;

  @ApiProperty({
    description: '방문자 목록 (내가 심은 알일 때 의미 있음)',
    type: [EggViewerDto],
  })
  viewers: EggViewerDto[];
}
