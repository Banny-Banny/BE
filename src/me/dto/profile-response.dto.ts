import { ApiProperty } from '@nestjs/swagger';

/**
 * 프로필 조회 응답 DTO
 * GET /api/me 응답 데이터
 */
export class ProfileResponseDto {
  @ApiProperty({
    description: '사용자 고유 ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: '닉네임',
    example: '바니바니',
  })
  nickname: string;

  @ApiProperty({
    description: '이름',
    example: '홍길동',
    nullable: true,
  })
  name: string | null;

  @ApiProperty({
    description: '이메일',
    example: 'user@example.com',
    nullable: true,
  })
  email: string | null;

  @ApiProperty({
    description: '전화번호',
    example: '01012345678',
  })
  phoneNumber: string;

  @ApiProperty({
    description: '프로필 이미지 URL',
    example: 'https://s3.amazonaws.com/bucket/profile/123.jpg',
    nullable: true,
  })
  profileImg: string | null;

  @ApiProperty({
    description: '푸시 알림 수신 동의 여부',
    example: true,
  })
  isPushAgreed: boolean;

  @ApiProperty({
    description: '마케팅 알림 수신 동의 여부',
    example: false,
  })
  isMarketingAgreed: boolean;

  @ApiProperty({
    description: '이스터에그 작성 가능 슬롯 수',
    example: 3,
  })
  eggSlots: number;

  @ApiProperty({
    description: '가입일',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt: Date;

  constructor(partial: Partial<ProfileResponseDto>) {
    Object.assign(this, partial);
  }
}

