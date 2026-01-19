import { ApiProperty } from '@nestjs/swagger';
import { PaginatedResponseDto } from './pagination.dto';

/**
 * 친구 프로필 정보 DTO
 */
export class FriendProfileDto {
  @ApiProperty({
    description: '사용자 ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: '닉네임',
    example: '바니친구',
  })
  nickname: string;

  @ApiProperty({
    description: '프로필 이미지 URL',
    example: 'https://s3.amazonaws.com/bucket/profile/123.jpg',
    nullable: true,
  })
  profileImg: string | null;

  constructor(partial: Partial<FriendProfileDto>) {
    Object.assign(this, partial);
  }
}

/**
 * 친구 관계 아이템 DTO
 */
export class FriendshipItemDto {
  @ApiProperty({
    description: '친구 관계 ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: '친구 관계 상태 (PENDING, CONNECTED, BLOCKED)',
    example: 'CONNECTED',
  })
  status: string;

  @ApiProperty({
    description: '친구 프로필 정보',
    type: FriendProfileDto,
  })
  friend: FriendProfileDto;

  @ApiProperty({
    description: '친구 관계 생성일',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt: Date;

  constructor(partial: Partial<FriendshipItemDto>) {
    Object.assign(this, partial);
  }
}

/**
 * 친구 목록 응답 DTO (페이지네이션)
 */
export class PaginatedFriendResponseDto extends PaginatedResponseDto<FriendshipItemDto> {
  @ApiProperty({
    description: '친구 목록',
    type: [FriendshipItemDto],
  })
  declare items: FriendshipItemDto[];

  constructor(
    items: FriendshipItemDto[],
    total: number,
    limit: number,
    offset: number,
  ) {
    super(items, total, limit, offset);
  }
}
