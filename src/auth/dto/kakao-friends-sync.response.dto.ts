import { ApiProperty } from '@nestjs/swagger';

export class KakaoFriendsSyncDataDto {
  @ApiProperty({
    description: '동기화 성공 여부',
    example: true,
  })
  isSynced: boolean;

  @ApiProperty({
    description: '동기화된 친구 수',
    example: 12,
  })
  syncedCount: number;

  @ApiProperty({
    description: '마지막 동기화 시간',
    example: '2026-01-08T10:00:00Z',
  })
  lastSyncedAt: string;
}

export class KakaoFriendsSyncResponseDto {
  @ApiProperty({
    description: '요청 성공 여부',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: '동기화 결과 데이터',
    type: KakaoFriendsSyncDataDto,
  })
  data: KakaoFriendsSyncDataDto;
}
