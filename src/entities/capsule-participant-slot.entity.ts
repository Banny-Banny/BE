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
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'user_id' })
  user: User | null;
}

