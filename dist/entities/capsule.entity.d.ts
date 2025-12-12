import { MediaType } from '../common/enums';
import { User } from './user.entity';
import { Product } from './product.entity';
import { CapsuleAccessLog } from './capsule-access-log.entity';
export declare class Capsule {
    id: string;
    userId: string;
    productId: string;
    latitude: number;
    longitude: number;
    title: string;
    content: string;
    mediaUrl: string;
    mediaType: MediaType;
    openAt: Date;
    isLocked: boolean;
    viewLimit: number;
    viewCount: number;
    createdAt: Date;
    deletedAt: Date;
    user: User;
    product: Product;
    accessLogs: CapsuleAccessLog[];
}
