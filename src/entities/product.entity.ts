import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { MediaType } from '../common/enums';
import { Capsule } from './capsule.entity';
import { Order } from './order.entity';

/**
 * 캡슐 생성 시 사용되는 유료/무료 아이템 정보
 * 가격 정책 변경 시에도 기존 결제 내역 무결성을 위해 데이터 유지
 */
@Entity('products')
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
    enum: MediaType,
    name: 'media_type',
    comment: '이 상품 구매 시 사용 가능한 미디어 타입',
  })
  mediaType: MediaType;

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
    comment: 'True: 판매중, False: 판매중단',
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
