import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { FriendStatus } from '../common/enums';
import { User } from './user.entity';

/**
 * 유저 간의 친구 관계 관리
 * 양방향 친구일 경우 정책에 따라 데이터 2줄 생성 고려 가능
 */
@Entity('friendships')
@Unique(['userId', 'friendId']) // 동일한 두 사람 간의 중복 관계 데이터 방지
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
