import { ApiProperty } from '@nestjs/swagger';

export class UserSummaryDto {
  @ApiProperty({
    description: '작성한 캡슐 개수',
    example: 3,
  })
  capsuleCount: number;

  @ApiProperty({
    description: '작성한 이스터에그 개수 (viewLimit이 설정된 캡슐)',
    example: 12,
  })
  easterEggCount: number;

  @ApiProperty({
    description: '친구 수',
    example: 8,
  })
  friendCount: number;
}

export class UserProfileDataDto {
  @ApiProperty({
    description: '닉네임',
    example: '토끼유저',
  })
  nickname: string;

  @ApiProperty({
    description: '이메일',
    example: 'rabbit@example.com',
    nullable: true,
  })
  email: string | null;

  @ApiProperty({
    description: '프로필 이미지 URL',
    example: 'https://example.com/profiles/rabbit.png',
    nullable: true,
  })
  profileImageUrl: string | null;

  @ApiProperty({
    description: '사용자 통계 요약',
    type: UserSummaryDto,
  })
  summary: UserSummaryDto;
}

export class UserProfileResponseDto {
  @ApiProperty({
    description: '응답 성공 여부',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: '사용자 프로필 데이터',
    type: UserProfileDataDto,
  })
  data: UserProfileDataDto;
}

