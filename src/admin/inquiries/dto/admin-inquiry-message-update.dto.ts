import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class AdminInquiryMessageUpdateDto {
  @ApiProperty({ example: '문의 답변 내용 수정' })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content: string;
}
