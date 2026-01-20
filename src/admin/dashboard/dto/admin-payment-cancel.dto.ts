import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Length } from 'class-validator';

export class AdminPaymentCancelDto {
  @ApiProperty({ description: '환불 사유' })
  @IsString()
  @Length(1, 200)
  cancelReason: string;

  @ApiPropertyOptional({ description: '부분 취소 금액' })
  @IsOptional()
  @IsInt()
  cancelAmount?: number;

  @ApiPropertyOptional({
    description: '가상계좌 환불 계좌 (필요 시)',
  })
  @IsOptional()
  refundReceiveAccount?: {
    bank: string;
    accountNumber: string;
    holderName: string;
  };
}
