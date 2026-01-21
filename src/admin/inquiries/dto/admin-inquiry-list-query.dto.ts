import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { InquiryStatus } from '../../../common/enums';

export class AdminInquiryListQueryDto {
  @ApiPropertyOptional({
    enum: [...Object.values(InquiryStatus), 'ALL'],
    description: '문의 상태 필터',
    default: 'ALL',
  })
  @IsOptional()
  @IsIn([...Object.values(InquiryStatus), 'ALL'])
  status?: InquiryStatus | 'ALL' = 'ALL';

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}
