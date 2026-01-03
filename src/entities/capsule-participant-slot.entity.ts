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
import { Capsule } from './capsule.entity';
import { User } from './user.entity';
import { Media } from './media.entity';

@Entity('capsule_participant_slots')
@Unique(['capsuleId', 'slotIndex'])
@Unique(['capsuleId', 'userId'])
export class CapsuleParticipantSlot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'capsule_id' })
  capsuleId: string;

  @Column({ type: 'int', name: 'slot_index' })
  slotIndex: number;

  @Column({ type: 'uuid', name: 'user_id', nullable: true })
  userId: string | null;

  @Column({
    type: 'timestamp',
    name: 'assigned_at',
    nullable: true,
    comment: '슬롯이 사용자에게 배정된 시각',
  })
  assignedAt: Date | null;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
    comment: '참여자 닉네임 (저장 시점 스냅샷)',
  })
  nickname: string | null;

  @Column({
    type: 'text',
    name: 'text_message',
    nullable: true,
    comment: '참여자가 작성한 텍스트 메시지',
  })
  textMessage: string | null;

  @Column({
    type: 'enum',
    enum: ['PENDING', 'COMPLETED'],
    default: 'PENDING',
    comment: '작성 상태 (PENDING: 미작성, COMPLETED: 작성완료)',
  })
  status: 'PENDING' | 'COMPLETED';

  @Column({
    type: 'uuid',
    array: true,
    name: 'image_ids',
    nullable: true,
    comment: '업로드된 이미지 Media ID 배열',
  })
  imageIds: string[] | null;

  @Column({
    type: 'uuid',
    name: 'music_id',
    nullable: true,
    comment: '업로드된 음성 Media ID',
  })
  musicId: string | null;

  @Column({
    type: 'uuid',
    name: 'video_id',
    nullable: true,
    comment: '업로드된 동영상 Media ID',
  })
  videoId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Capsule, (capsule) => capsule.participantSlots, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'capsule_id' })
  capsule: Capsule;

  @ManyToOne(() => User, (user) => user.participantSlots, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @ManyToOne(() => Media, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'music_id' })
  music: Media | null;

  @ManyToOne(() => Media, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'video_id' })
  video: Media | null;
}
