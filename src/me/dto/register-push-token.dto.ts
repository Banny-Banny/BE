import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * 푸시 토큰 등록 요청 DTO
 */
export class RegisterPushTokenDto {
  @ApiProperty({
    description: 'Expo Push 토큰 (ExponentPushToken[xxxxx] 형식)',
    example: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
    maxLength: 255,
  })
  @IsNotEmpty({ message: '푸시 토큰은 필수 입력입니다.' })
  @IsString({ message: '푸시 토큰은 문자열이어야 합니다.' })
  @MaxLength(255, { message: '푸시 토큰은 최대 255자까지 입력 가능합니다.' })
  token: string;
}
