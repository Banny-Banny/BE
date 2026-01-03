import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Check,
} from 'typeorm';
import { FriendStatus } from '../common/enums';
import { User } from './user.entity';

/**
 * 유저 간의 친구 관계 관리
 * 정책: user_id < friend_id 순서로만 저장 (양방향 중복 방지)
 */
@Entity('friendships')
@Unique(['userId', 'friendId'])
@Check('user_id < friend_id')
export class Friendship {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id', comment: '요청자' })
  userId: string;

  @Column({ type: 'uuid', name: 'friend_id', comment: '대상자' })
  friendId: string;

  @Column({
    type: 'enum',
    enum: FriendStatus,
    default: FriendStatus.PENDING,
    comment: '현재 관계 상태',
  })
  status: FriendStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    nullable: true,
    comment: '상태 변경(수락/차단) 일시',
  })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => User, (user) => user.friendships, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => User, (user) => user.friendOf, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'friend_id' })
  friend: User;
}
