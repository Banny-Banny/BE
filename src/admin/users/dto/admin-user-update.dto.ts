import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class AdminUserUpdateDto {
  @ApiPropertyOptional({ example: '김바니' })
  @IsOptional()
  @IsString()
  nickname?: string;

  @ApiPropertyOptional({ example: 'user@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '01012345678' })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/profile.png' })
  @IsOptional()
  @IsString()
  profileImg?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isMarketingAgreed?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isPushAgreed?: boolean;
}
