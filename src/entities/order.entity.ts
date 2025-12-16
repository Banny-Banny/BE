import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToOne,
} from 'typeorm';
import { OrderStatus } from '../common/enums';
import { User } from './user.entity';
import { Product } from './product.entity';
import { Payment } from './payment.entity';

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
    enum: OrderStatus,
    default: OrderStatus.PENDING,
    comment: '결제 프로세스 상태',
  })
  status: OrderStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

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
}
