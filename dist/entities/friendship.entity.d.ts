import { FriendStatus } from '../common/enums';
import { User } from './user.entity';
export declare class Friendship {
    id: string;
    userId: string;
    friendId: string;
    status: FriendStatus;
    createdAt: Date;
    updatedAt: Date;
    user: User;
    friend: User;
}
