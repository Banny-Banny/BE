import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * 공지사항 (Notice)
 */
@Entity('notices')
export class Notice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column({
    type: 'text',
    name: 'image_url',
    nullable: true,
    comment: '공지 이미지 URL',
  })
  imageUrl: string | null;

  @Column({
    type: 'boolean',
    default: false,
    name: 'is_pinned',
    comment: '상단 고정 여부',
  })
  isPinned: boolean;

  @Column({
    type: 'boolean',
    default: true,
    name: 'is_visible',
    comment: '노출 여부',
  })
  isVisible: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', nullable: true })
  updatedAt: Date | null;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}
