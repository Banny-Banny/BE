import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { PaymentStatus } from '../common/enums';
import { Order } from './order.entity';

/**
 * 재무적 가치가 있는 실제 결제 승인 데이터
 * 절대 삭제되거나 임의 수정되면 안 됨
 */
@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'uuid',
    name: 'order_id',
    unique: true,
    comment: '1:1 관계. 하나의 주문에는 하나의 결제 건만 존재',
  })
  orderId: string;

  @Column({
    type: 'varchar',
    length: 100,
    unique: true,
    name: 'pg_tid',
    comment: 'PG사(카카오페이)에서 발급한 고유 거래번호',
  })
  pgTid: string;

  @Column({
    type: 'int',
    comment: '실제 승인된 금액',
  })
  amount: number;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.READY,
  })
  status: PaymentStatus;

  @Column({
    type: 'timestamp',
    nullable: true,
    name: 'approved_at',
    comment: '결제 승인 일시',
  })
  approvedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Relations
  @OneToOne(() => Order, (order) => order.payment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;
}
