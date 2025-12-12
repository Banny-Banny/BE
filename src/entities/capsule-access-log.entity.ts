import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Capsule } from './capsule.entity';
import { User } from './user.entity';

/**
 * 조회수 어뷰징 방지 및 선착순 당첨자 기록용 로그 테이블
 */
@Entity('capsule_access_logs')
@Unique(['capsuleId', 'viewerId']) // 한 유저는 동일 캡슐의 조회수를 1번만 올릴 수 있음
export class CapsuleAccessLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'capsule_id' })
  capsuleId: string;

  @Column({ type: 'uuid', name: 'viewer_id' })
  viewerId: string;

  @CreateDateColumn({ name: 'viewed_at' })
  viewedAt: Date;

  // Relations
  @ManyToOne(() => Capsule, (capsule) => capsule.accessLogs, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'capsule_id' })
  capsule: Capsule;

  @ManyToOne(() => User, (user) => user.accessLogs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'viewer_id' })
  viewer: User;
}
