import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToOne,
  UpdateDateColumn,
} from 'typeorm';
import { OrderStatus, TimeOption } from '../common/enums';
import { User } from './user.entity';
import { Product } from './product.entity';
import { Payment } from './payment.entity';
import { Capsule } from './capsule.entity';

/**
 * 사용자의 주문 시도 내역
 * 실제 결제 성공 여부는 Payments 테이블에서 확인
 */
@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'uuid', name: 'product_id' })
  productId: string;

  @Column({
    type: 'int',
    name: 'total_amount',
    comment: '할인 등이 적용된 최종 결제 금액',
  })
  totalAmount: number;

  @Column({
    type: 'enum',
    enum: TimeOption,
    name: 'time_option',
    comment: '열람 시점 옵션',
  })
  timeOption: TimeOption;

  @Column({
    type: 'timestamp',
    name: 'custom_open_at',
    nullable: true,
    comment: 'CUSTOM 옵션일 때 지정 시각',
  })
  customOpenAt: Date | null;

  @Column({
    type: 'int',
    name: 'headcount',
    comment: '인원수 (1~10)',
  })
  headcount: number;

  @Column({
    type: 'int',
    name: 'photo_count',
    default: 0,
    comment: '총 사진 장수 (장당 500원, 총합 ≤ headcount*5)',
  })
  photoCount: number;

  @Column({ type: 'boolean', name: 'add_music', default: false })
  addMusic: boolean;

  @Column({ type: 'boolean', name: 'add_video', default: false })
  addVideo: boolean;

  @Column({
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.PENDING_PAYMENT,
    comment: '결제 프로세스 상태',
  })
  status: OrderStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', nullable: true })
  updatedAt: Date | null;

  // Relations
  @ManyToOne(() => User, (user) => user.orders, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Product, (product) => product.orders, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @OneToOne(() => Payment, (payment) => payment.order)
  payment: Payment;

  @OneToOne(() => Capsule, (capsule) => capsule.order)
  capsule: Capsule | null;
}
