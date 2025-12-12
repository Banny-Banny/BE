import { PaymentStatus } from '../common/enums';
import { Order } from './order.entity';
export declare class Payment {
    id: string;
    orderId: string;
    pgTid: string;
    amount: number;
    status: PaymentStatus;
    approvedAt: Date;
    createdAt: Date;
    order: Order;
}
