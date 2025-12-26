import { IsInt, IsOptional, IsString, Length } from 'class-validator';

export class TossCancelDto {
  @IsString()
  @Length(1, 200)
  paymentKey: string;

  @IsString()
  @Length(1, 200)
  cancelReason: string;

  @IsOptional()
  @IsInt()
  cancelAmount?: number;

  @IsOptional()
  refundReceiveAccount?: {
    bank: string;
    accountNumber: string;
    holderName: string;
  };
}

