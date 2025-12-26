import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToOne,
  Unique,
} from 'typeorm';
import { Capsule } from './capsule.entity';
import { CapsuleParticipantSlot } from './capsule-participant-slot.entity';
import { User } from './user.entity';
import { MediaType } from '../common/enums';

@Entity('capsule_entries')
@Unique(['capsuleId', 'userId'])
export class CapsuleEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'capsule_id' })
  capsuleId: string;

  @Column({ type: 'uuid', name: 'slot_id', unique: true })
  slotId: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'text' })
  content: string;

  @Column({
    type: 'uuid',
    array: true,
    name: 'media_item_ids',
    nullable: true,
  })
  mediaItemIds: string[] | null;

  @Column({
    type: 'enum',
    enum: MediaType,
    array: true,
    name: 'media_types',
    nullable: true,
  })
  mediaTypes: MediaType[] | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Capsule, (capsule) => capsule.entries, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'capsule_id' })
  capsule: Capsule;

  @ManyToOne(() => User, (user) => user.entries, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToOne(() => CapsuleParticipantSlot, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'slot_id' })
  slot: CapsuleParticipantSlot;
}

