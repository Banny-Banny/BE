import { IsEnum } from 'class-validator';
import { OrderStatus } from '../../common/enums';

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus)
  status: OrderStatus;
}
