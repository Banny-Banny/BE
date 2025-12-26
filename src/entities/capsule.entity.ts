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
import { MediaType } from '../common/enums';
import { User } from './user.entity';
import { Product } from './product.entity';
import { CapsuleAccessLog } from './capsule-access-log.entity';
import { Order } from './order.entity';

/**
 * 서비스의 핵심 테이블
 * 타임캡슐(시간제한)과 이스터에그(선착순/위치기반) 데이터를 모두 처리함
 */
@Entity('capsules')
@Check(
  '(media_urls IS NULL OR array_length(media_urls, 1) <= 3) AND (media_types IS NULL OR array_length(media_types, 1) <= 3)',
)
export class Capsule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id', comment: '작성자(Owner)' })
  userId: string;

  @Column({
    type: 'uuid',
    name: 'product_id',
    nullable: true,
    comment: '유료 스킨/기능 사용 시 연결, 무료면 NULL',
  })
  productId: string | null;

  @Column({
    type: 'uuid',
    name: 'order_id',
    nullable: true,
    unique: true,
    comment: '결제 주문 연계 (주문당 1캡슐)',
  })
  orderId: string | null;

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

  @Column({
    type: 'text',
    array: true,
    nullable: true,
    name: 'media_urls',
    comment:
      '업로드된 파일의 CDN/S3 경로 목록 (최대 3개, nullable entries 허용)',
  })
  mediaUrls: (string | null)[] | null;

  @Column({
    type: 'uuid',
    array: true,
    nullable: true,
    name: 'media_item_ids',
    comment: 'Media 엔티티 id 목록 (presign/complete 이후 캡슐에 연결)',
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

  // 핵심 로직 (시간 & 수량)
  @Column({
    type: 'timestamp',
    nullable: true,
    name: 'open_at',
    comment: '개봉 예정일. 이 시간이 지나야 is_locked 해제 가능',
  })
  openAt: Date | null;

  @Column({
    type: 'boolean',
    default: true,
    name: 'is_locked',
    comment: 'App 표시용 플래그. open_at 비교 후 서버에서 업데이트',
  })
  isLocked: boolean;

  @Column({
    type: 'int',
    default: 0,
    name: 'view_limit',
    comment: '선착순 인원 제한 (이스터에그용). 0이면 무제한',
  })
  viewLimit: number;

  @Column({
    type: 'int',
    default: 0,
    name: 'view_count',
    comment: '현재까지 열람한 인원 수. view_limit 도달 시 마감',
  })
  viewCount: number;

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

  @ManyToOne(() => Product, (product) => product.capsules, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @OneToOne(() => Order, (order) => order.capsule, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'order_id' })
  order: Order | null;

  @OneToMany(() => CapsuleAccessLog, (log) => log.capsule)
  accessLogs: CapsuleAccessLog[];
}
