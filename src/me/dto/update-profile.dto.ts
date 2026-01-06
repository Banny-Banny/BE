import { IsString, IsEmail, IsOptional, Length } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * 프로필 수정 DTO
 * PATCH /api/me 요청 바디
 */
export class UpdateProfileDto {
  @ApiPropertyOptional({
    description: '닉네임 (2-20자)',
    example: '새로운닉네임',
    minLength: 2,
    maxLength: 20,
  })
  @IsOptional()
  @IsString()
  @Length(2, 20, { message: '닉네임은 2-20자 사이여야 합니다.' })
  nickname?: string;

  @ApiPropertyOptional({
    description: '이메일',
    example: 'newemail@example.com',
  })
  @IsOptional()
  @IsEmail({}, { message: '올바른 이메일 형식이 아닙니다.' })
  email?: string;
}

