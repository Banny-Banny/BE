import { IsNumber, IsString, Length } from 'class-validator';

export class TossConfirmDto {
  @IsString()
  @Length(1, 200)
  paymentKey: string;

  @IsString()
  @Length(6, 200)
  orderId: string;

  @IsNumber()
  amount: number;
}

