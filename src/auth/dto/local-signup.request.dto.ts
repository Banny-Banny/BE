import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  MinLength,
  Matches,
  IsUrl,
} from 'class-validator';

export class LocalSignupRequestDto {
  @ApiProperty({
    description: '서비스에서 표시할 닉네임',
    minLength: 2,
    maxLength: 30,
    example: '타임캡슐러',
  })
  @IsString()
  @Length(2, 30)
  nickname: string;

  @ApiProperty({
    description: '휴대폰 번호 (숫자만)',
    example: '01012345678',
  })
  @IsString()
  @Matches(/^\d{8,16}$/, {
    message: 'phoneNumber는 숫자 8~16자리여야 합니다.',
  })
  phoneNumber: string;

  @ApiProperty({
    description: '영문/숫자 포함 8자 이상의 비밀번호',
    minLength: 8,
    example: 'Password123!',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;

  @ApiProperty({
    description: '선택 입력: 알림/복구용 이메일',
    required: false,
    example: 'user@example.com',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({
    description: '선택 입력: 프로필 이미지 URL',
    required: false,
    example: 'https://s3.amazonaws.com/example/profile.png',
  })
  @IsOptional()
  @IsUrl()
  profileImg?: string;
}

