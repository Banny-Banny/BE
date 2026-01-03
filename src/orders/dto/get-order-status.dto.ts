import { IsUUID } from 'class-validator';

export class GetOrderStatusParamDto {
  @IsUUID()
  orderId: string;
}
