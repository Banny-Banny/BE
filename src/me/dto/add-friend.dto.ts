import { IsString, Matches, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 친구 추가 요청 DTO
 * POST /api/me/friends 요청 바디
 */
export class AddFriendDto {
  @ApiProperty({
    description: '친구의 전화번호 (숫자만, 10-11자)',
    example: '01012345678',
  })
  @IsString()
  @Length(10, 11, { message: '전화번호는 10-11자리여야 합니다.' })
  @Matches(/^[0-9]+$/, { message: '전화번호는 숫자만 입력 가능합니다.' })
  phoneNumber: string;
}

/**
 * 친구 추가 응답 DTO
 */
export class AddFriendResponseDto {
  @ApiProperty({
    description: '응답 메시지',
    example: '친구가 추가되었습니다.',
  })
  message: string;

  @ApiProperty({
    description: '생성된 친구 관계 ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  friendshipId: string;

  constructor(message: string, friendshipId: string) {
    this.message = message;
    this.friendshipId = friendshipId;
  }
}

