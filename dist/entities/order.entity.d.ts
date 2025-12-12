import { OrderStatus } from '../common/enums';
import { User } from './user.entity';
import { Product } from './product.entity';
import { Payment } from './payment.entity';
export declare class Order {
    id: string;
    userId: string;
    productId: string;
    totalAmount: number;
    status: OrderStatus;
    createdAt: Date;
    user: User;
    product: Product;
    payment: Payment;
}
