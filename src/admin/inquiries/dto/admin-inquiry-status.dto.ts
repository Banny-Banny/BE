import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { InquiryStatus } from '../../../common/enums';

export class AdminInquiryStatusDto {
  @ApiProperty({ enum: InquiryStatus, description: '문의 상태' })
  @IsEnum(InquiryStatus)
  status: InquiryStatus;
}
