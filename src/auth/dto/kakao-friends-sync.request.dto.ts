import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class KakaoFriendsSyncRequestDto {
  @ApiProperty({
    description: '카카오 인가 코드 (friends 권한 포함)',
    example: 'kakao_authorization_code_with_friends_scope',
  })
  @IsNotEmpty()
  @IsString()
  code: string;

  @ApiProperty({
    description: '리다이렉트 URI',
    example: 'https://service.com/callback/kakao-friends',
  })
  @IsNotEmpty()
  @IsString()
  redirectUri: string;
}
