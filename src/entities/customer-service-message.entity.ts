import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { CustomerService } from './customer-service.entity';
import { InquirySenderType } from '../common/enums';
import { User } from './user.entity';
import { AdminUser } from './admin-user.entity';

/**
 * 1:1 문의 채팅 메시지
 */
@Entity('customer_service_messages')
export class CustomerServiceMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'customer_service_id' })
  customerServiceId: string;

  @Column({
    type: 'enum',
    enum: InquirySenderType,
    enumName: 'inquiry_sender_type',
    name: 'sender_type',
  })
  senderType: InquirySenderType;

  @Column({ type: 'uuid', name: 'sender_user_id', nullable: true })
  senderUserId: string | null;

  @Column({ type: 'uuid', name: 'sender_admin_id', nullable: true })
  senderAdminId: string | null;

  @Column({ type: 'text' })
  content: string;

  @Column({
    type: 'boolean',
    default: false,
    name: 'is_read_by_admin',
  })
  isReadByAdmin: boolean;

  @Column({
    type: 'boolean',
    default: false,
    name: 'is_read_by_user',
  })
  isReadByUser: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;

  @ManyToOne(() => CustomerService, (service) => service.messages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'customer_service_id' })
  customerService: CustomerService;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'sender_user_id' })
  senderUser: User | null;

  @ManyToOne(() => AdminUser, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'sender_admin_id' })
  senderAdmin: AdminUser | null;
}
