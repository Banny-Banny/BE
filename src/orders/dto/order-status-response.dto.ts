import { OrderStatus, PaymentStatus } from '../../common/enums';

export class OrderStatusResponseDto {
  order_id: string;
  order_status: OrderStatus;
  payment_status: PaymentStatus | null;
  total_amount: number;
  payment_amount: number | null;
  payment_key: string | null;
  approved_at: Date | null;
  created_at: Date;
  updated_at: Date | null;
}

