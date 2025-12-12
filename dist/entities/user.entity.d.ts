import { Capsule } from './capsule.entity';
import { Order } from './order.entity';
import { Friendship } from './friendship.entity';
import { CapsuleAccessLog } from './capsule-access-log.entity';
import { CustomerService } from './customer-service.entity';
export declare class User {
    id: string;
    nickname: string;
    phoneNumber: string;
    email: string;
    profileImg: string;
    kakaoId: string;
    isMarketingAgreed: boolean;
    isPushAgreed: boolean;
    isLocationTermAgreed: boolean;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date;
    capsules: Capsule[];
    orders: Order[];
    friendships: Friendship[];
    friendOf: Friendship[];
    accessLogs: CapsuleAccessLog[];
    customerServices: CustomerService[];
}
