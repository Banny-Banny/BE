import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class AdminCreateDto {
  @ApiProperty({ example: 'newadmin@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '운영자' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'password1234' })
  @IsString()
  @MinLength(8)
  password: string;
}
