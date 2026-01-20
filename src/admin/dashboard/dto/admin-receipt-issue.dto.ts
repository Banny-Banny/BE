import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional } from 'class-validator';

export class AdminReceiptIssueDto {
  @ApiPropertyOptional({ description: '영수증 재전송 이메일(선택)' })
  @IsOptional()
  @IsEmail()
  email?: string;
}
