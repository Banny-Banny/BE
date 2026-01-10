import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { NotificationType } from '../common/enums/notification-type.enum';

/**
 * 사용자 알림 엔티티
 * 사용자에게 발송되는 알림 정보를 관리
 */
@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid', {
    comment: '알림 고유 ID',
  })
  id: string;

  @Column({
    type: 'uuid',
    name: 'user_id',
    comment: '알림 수신자',
  })
  userId: string;

  @Column({
    type: 'varchar',
    length: 100,
    comment: '알림 제목',
  })
  title: string;

  @Column({
    type: 'text',
    comment: '알림 내용',
  })
  content: string;

  @Column({
    type: 'enum',
    enum: NotificationType,
    comment: '알림 타입: CAPSULE_OPEN, FRIEND_ADD, EGG_DISCOVERED, EGG_DELETED, SYSTEM, MARKETING',
  })
  type: NotificationType;

  @Column({
    type: 'boolean',
    default: false,
    name: 'is_read',
    comment: '읽음 여부',
  })
  isRead: boolean;

  @CreateDateColumn({
    name: 'created_at',
    comment: '알림 생성일',
  })
  createdAt: Date;

  // Relations
  @ManyToOne(() => User, (user) => user.notifications, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}

