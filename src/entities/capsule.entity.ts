import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  OneToOne,
  Check,
} from 'typeorm';
import { MediaType, CapsuleType } from '../common/enums';
import { User } from './user.entity';
import { CapsuleAccessLog } from './capsule-access-log.entity';
import { CapsuleParticipantSlot } from './capsule-participant-slot.entity';
import { CapsuleEntry } from './capsule-entry.entity';
import { TimeCapsule } from './time-capsule.entity';
import { EasterEgg } from './easter-egg.entity';

/**
 * 서비스의 핵심 테이블
 * 타임캡슐(시간제한)과 이스터에그(선착순/위치기반) 데이터를 모두 처리함
 */
@Entity('capsules')
@Check(
  '(media_urls IS NULL OR array_length(media_urls, 1) <= 10) AND (media_types IS NULL OR array_length(media_types, 1) <= 10)',
)
export class Capsule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id', comment: '작성자(Owner)' })
  userId: string;

  @Column({
    type: 'enum',
    enum: CapsuleType,
    name: 'capsule_type',
    default: CapsuleType.EASTER_EGG,
    comment: '캡슐 타입 (TIME_CAPSULE / EASTER_EGG)',
  })
  capsuleType: CapsuleType;

  // 위치 정보
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 8,
    nullable: true,
    comment: '위도: 소수점 8자리로 cm 단위 정밀도 보장',
  })
  latitude: number | null;

  @Column({
    type: 'decimal',
    precision: 11,
    scale: 8,
    nullable: true,
    comment: '경도: 소수점 8자리로 cm 단위 정밀도 보장',
  })
  longitude: number | null;

  // 콘텐츠
  @Column({ type: 'varchar', length: 100 })
  title: string;

  @Column({
    type: 'varchar',
    length: 500,
    nullable: true,
    comment: '사용자가 작성한 메시지',
  })
  content: string | null;

  /**
   * @deprecated media_urls는 향후 제거 예정. media_item_ids 사용 권장.
   */
  @Column({
    type: 'text',
    array: true,
    nullable: true,
    name: 'media_urls',
    comment:
      '[DEPRECATED] 업로드된 파일의 CDN/S3 경로. media_item_ids 사용 권장',
  })
  mediaUrls: (string | null)[] | null;

  @Column({
    type: 'uuid',
    array: true,
    nullable: true,
    name: 'media_item_ids',
    comment:
      'Media 엔티티 id 목록 (presign/complete 이후 캡슐에 연결). URL은 Media 조인으로 획득',
  })
  mediaItemIds: string[] | null;

  @Column({
    type: 'enum',
    enum: MediaType,
    array: true,
    nullable: true,
    name: 'media_types',
    comment: '저장된 미디어의 종류 목록 (최대 3개, TEXT/IMAGE/VIDEO/MUSIC)',
  })
  mediaTypes: (MediaType | null)[] | null;

  @Column({
    type: 'jsonb',
    nullable: true,
    name: 'text_blocks',
    comment: '텍스트 블록 배열 { order, content }',
  })
  textBlocks:
    | {
        order: number;
        content: string;
      }[]
    | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @DeleteDateColumn({
    name: 'deleted_at',
    nullable: true,
    comment: '사용자가 삭제했거나, 선착순 마감되어 지도에서 사라진 시점',
  })
  deletedAt: Date;

  // Relations
  @ManyToOne(() => User, (user) => user.capsules, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToOne(() => TimeCapsule, (timeCapsule) => timeCapsule.capsule)
  timeCapsule: TimeCapsule | null;

  @OneToOne(() => EasterEgg, (easterEgg) => easterEgg.capsule)
  easterEgg: EasterEgg | null;

  @OneToMany(() => CapsuleAccessLog, (log) => log.capsule)
  accessLogs: CapsuleAccessLog[];

  @OneToMany(() => CapsuleParticipantSlot, (slot) => slot.capsule)
  participantSlots: CapsuleParticipantSlot[];

  @OneToMany(() => CapsuleEntry, (entry) => entry.capsule)
  entries: CapsuleEntry[];
}
