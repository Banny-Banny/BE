/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { PaymentStatus } from '../common/enums';
import { Order } from './order.entity';
import { PaymentCancel } from './payment-cancel.entity';

/**
 * 재무적 가치가 있는 실제 결제 승인 데이터
 * 절대 삭제되거나 임의 수정되면 안 됨
 */
@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * 토스페이먼츠 paymentKey (고유)
   */
  @Column({
    type: 'varchar',
    length: 200,
    name: 'payment_key',
    unique: true,
    nullable: true,
  })
  paymentKey: string | null;

  @Column({
    type: 'uuid',
    name: 'order_id',
    unique: true,
    comment: '1:1 관계. 하나의 주문에는 하나의 결제 건만 존재',
  })
  orderId: string;

  /**
   * 토스에 전달한 주문번호 (orderId)
   */
  @Column({
    type: 'varchar',
    length: 100,
    name: 'order_no',
    nullable: true,
  })
  orderNo: string | null;

  /**
   * 토스 주문명
   */
  @Column({
    type: 'varchar',
    length: 100,
    name: 'order_name',
    nullable: true,
  })
  orderName: string | null;

  /**
   * 토스 상태 (READY/IN_PROGRESS/DONE/CANCELED/PARTIAL_CANCELED/ABORTED/EXPIRED)
   */
  @Column({
    type: 'varchar',
    length: 30,
    name: 'toss_status',
    nullable: true,
  })
  tossStatus: string | null;

  /**
   * 결제수단 (카드/가상계좌/간편결제 등)
   */
  @Column({
    type: 'varchar',
    length: 30,
    name: 'method',
    nullable: true,
  })
  method: string | null;

  @Column({
    type: 'varchar',
    length: 10,
    default: 'KRW',
  })
  currency: string;

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
    type: 'int',
    name: 'balance_amount',
    nullable: true,
    comment: '취소 가능 잔액',
  })
  balanceAmount: number | null;

  @Column({
    type: 'int',
    name: 'supplied_amount',
    nullable: true,
  })
  suppliedAmount: number | null;

  @Column({
    type: 'int',
    name: 'vat',
    nullable: true,
  })
  vat: number | null;

  @Column({
    type: 'int',
    name: 'tax_free_amount',
    nullable: true,
  })
  taxFreeAmount: number | null;

  @Column({
    type: 'int',
    name: 'tax_exemption_amount',
    nullable: true,
  })
  taxExemptionAmount: number | null;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.READY,
  })
  status: PaymentStatus;

  @Column({
    type: 'timestamp with time zone',
    name: 'requested_at',
    nullable: true,
    comment: 'PG 결제 요청 시각',
  })
  requestedAt: Date | null;

  @Column({
    type: 'timestamp with time zone',
    nullable: true,
    name: 'approved_at',
    comment: '결제 승인 일시',
  })
  approvedAt: Date | null;

  @Column({
    type: 'varchar',
    length: 200,
    name: 'receipt_url',
    nullable: true,
  })
  receiptUrl: string | null;

  @Column({
    type: 'varchar',
    length: 100,
    name: 'last_transaction_key',
    nullable: true,
  })
  lastTransactionKey: string | null;

  @Column({
    type: 'varchar',
    length: 50,
    name: 'easy_pay_provider',
    nullable: true,
  })
  easyPayProvider: string | null;

  @Column({
    type: 'jsonb',
    name: 'card_meta',
    nullable: true,
    comment: '카드 메타 정보',
  })
  cardMeta: Record<string, unknown> | null;

  @Column({
    type: 'jsonb',
    name: 'virtual_account',
    nullable: true,
    comment: '가상계좌 정보',
  })
  virtualAccount: Record<string, unknown> | null;

  @Column({
    type: 'varchar',
    length: 100,
    name: 'fail_code',
    nullable: true,
  })
  failCode: string | null;

  @Column({
    type: 'varchar',
    length: 510,
    name: 'fail_message',
    nullable: true,
  })
  failMessage: string | null;

  @Column({
    type: 'jsonb',
    nullable: true,
    name: 'pg_raw',
    comment: 'PG 응답 원문 (준비/승인)',
  })
  pgRaw: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => PaymentCancel, (cancel) => cancel.payment, {
    cascade: false,
  })
  cancels: PaymentCancel[];

  // Relations
  @OneToOne(() => Order, (order) => order.payment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;
}
