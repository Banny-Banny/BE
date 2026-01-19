import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  DeleteDateColumn,
  OneToMany,
} from 'typeorm';
import { User } from './user.entity';
import { InquiryStatus } from '../common/enums';
import { CustomerServiceMessage } from './customer-service-message.entity';

/**
 * 1:1 문의 게시판
 */
@Entity('customer_services')
export class CustomerService {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 100 })
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column({
    type: 'text',
    nullable: true,
    name: 'admin_reply',
    comment: '관리자 페이지에서 작성한 답변',
  })
  adminReply: string;

  @Column({
    type: 'boolean',
    default: false,
    name: 'is_resolved',
    comment: '처리 완료 여부',
  })
  isResolved: boolean;

  @Column({
    type: 'enum',
    enum: InquiryStatus,
    enumName: 'inquiry_status',
    default: InquiryStatus.PENDING,
    comment: '문의 상태',
  })
  status: InquiryStatus;

  @Column({
    type: 'timestamp',
    nullable: true,
    name: 'last_message_at',
    comment: '마지막 메시지 시간',
  })
  lastMessageAt: Date | null;

  @Column({
    type: 'varchar',
    length: 200,
    nullable: true,
    name: 'last_message_preview',
    comment: '리스트용 마지막 메시지 미리보기',
  })
  lastMessagePreview: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    nullable: true,
    comment: '답변 작성 또는 수정 시간',
  })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;

  // Relations
  @ManyToOne(() => User, (user) => user.customerServices, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany(() => CustomerServiceMessage, (message) => message.customerService)
  messages: CustomerServiceMessage[];
}
