import { Capsule } from './capsule.entity';
import { User } from './user.entity';
export declare class CapsuleAccessLog {
    id: string;
    capsuleId: string;
    viewerId: string;
    viewedAt: Date;
    capsule: Capsule;
    viewer: User;
}
