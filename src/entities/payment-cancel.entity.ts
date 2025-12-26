import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Payment } from './payment.entity';

@Entity('payment_cancels')
@Unique(['transactionKey'])
export class PaymentCancel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'payment_id' })
  paymentId: string;

  @ManyToOne(() => Payment, (payment) => payment.cancels, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'payment_id' })
  payment: Payment;

  @Column({
    type: 'varchar',
    length: 100,
    name: 'transaction_key',
    comment: '토스 취소 거래 키',
  })
  transactionKey: string;

  @Column({ type: 'int', name: 'cancel_amount' })
  cancelAmount: number;

  @Column({
    type: 'varchar',
    length: 200,
    name: 'cancel_reason',
    nullable: true,
  })
  cancelReason: string | null;

  @Column({
    type: 'varchar',
    length: 30,
    name: 'cancel_status',
    nullable: true,
  })
  cancelStatus: string | null;

  @Column({
    type: 'timestamp with time zone',
    name: 'canceled_at',
    nullable: true,
  })
  canceledAt: Date | null;

  @Column({ type: 'int', name: 'tax_free_amount', nullable: true })
  taxFreeAmount: number | null;

  @Column({ type: 'int', name: 'tax_exemption_amount', nullable: true })
  taxExemptionAmount: number | null;

  @Column({ type: 'int', name: 'refundable_amount', nullable: true })
  refundableAmount: number | null;

  @Column({
    type: 'int',
    name: 'easy_pay_discount_amount',
    nullable: true,
  })
  easyPayDiscountAmount: number | null;

  @Column({
    type: 'int',
    name: 'transfer_discount_amount',
    nullable: true,
  })
  transferDiscountAmount: number | null;

  @Column({
    type: 'varchar',
    length: 200,
    name: 'receipt_key',
    nullable: true,
  })
  receiptKey: string | null;

  @Column({ type: 'jsonb', name: 'raw_response', nullable: true })
  rawResponse: any | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

