import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
  Check,
} from 'typeorm';
import { MediaType } from '../common/enums';
import { Capsule } from './capsule.entity';
import { Order } from './order.entity';

export enum ProductType {
  EASTER_EGG = 'EASTER_EGG',
  TIME_CAPSULE = 'TIME_CAPSULE',
}

/**
 * 캡슐 생성 시 사용되는 유료/무료 아이템 정보
 * 가격 정책 변경 시에도 기존 결제 내역 무결성을 위해 데이터 유지
 */
@Entity('products')
@Check(
  "(product_type <> 'EASTER_EGG') OR (max_media_count IS NOT NULL AND max_media_count BETWEEN 0 AND 3)",
)
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'varchar',
    length: 50,
    comment: '상품명 (예: 100년 타임캡슐)',
  })
  name: string;

  @Column({
    type: 'int',
    comment: '판매 가격 (0원이면 무료 아이템)',
  })
  price: number;

  @Column({
    type: 'enum',
    enum: ProductType,
    name: 'product_type',
    default: ProductType.TIME_CAPSULE,
    comment: '상품 유형: EASTER_EGG(제약 적용), TIME_CAPSULE(제약 없음)',
  })
  productType: ProductType;

  @Column({
    type: 'enum',
    enum: MediaType,
    array: true,
    name: 'media_types',
    nullable: true,
    comment:
      '이 상품으로 허용되는 미디어 타입 목록 (이스터에그 전용, 최대 3개 업로드 지원)',
  })
  mediaTypes: MediaType[] | null;

  @Column({
    type: 'int',
    name: 'max_media_count',
    nullable: true,
    comment:
      '업로드 가능한 미디어 최대 개수 (이스터에그: 최대 3개, 타임캡슐: null 허용)',
  })
  maxMediaCount: number | null;

  @Column({
    type: 'text',
    nullable: true,
    comment: '상품 상세 설명',
  })
  description: string;

  @Column({
    type: 'boolean',
    default: true,
    name: 'is_active',
    comment: 'True: 노출중, False: 비노출',
  })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Relations
  @OneToMany(() => Capsule, (capsule) => capsule.product)
  capsules: Capsule[];

  @OneToMany(() => Order, (order) => order.product)
  orders: Order[];
}
