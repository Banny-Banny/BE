import { MediaType } from '../common/enums';
import { Capsule } from './capsule.entity';
import { Order } from './order.entity';
export declare class Product {
    id: string;
    name: string;
    price: number;
    mediaType: MediaType;
    description: string;
    isActive: boolean;
    createdAt: Date;
    capsules: Capsule[];
    orders: Order[];
}
