import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Length, MaxLength, MinLength } from 'class-validator';

export class LocalLoginRequestDto {
  @ApiProperty({
    description: '휴대폰 번호 (번호 형식)',
    required: false,
    example: '01012345678',
  })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiProperty({
    description: '이메일 로그인 (선택)',
    required: false,
    example: 'user@example.com',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({
    description: '로컬 비밀번호',
    minLength: 8,
    example: 'Password123!',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;
}

