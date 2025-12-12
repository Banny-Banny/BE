import { User } from './user.entity';
export declare class CustomerService {
    id: string;
    userId: string;
    title: string;
    content: string;
    adminReply: string;
    isResolved: boolean;
    createdAt: Date;
    updatedAt: Date;
    user: User;
}
