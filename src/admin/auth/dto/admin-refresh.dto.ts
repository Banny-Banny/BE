import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class AdminRefreshDto {
  @ApiProperty({ example: 'refresh_token' })
  @IsString()
  refreshToken: string;
}
