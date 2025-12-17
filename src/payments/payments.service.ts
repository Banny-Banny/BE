import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Order } from '../entities/order.entity';
import { Payment } from '../entities/payment.entity';
import { ProductType } from '../entities/product.entity';
import { OrderStatus, PaymentStatus } from '../common/enums';
import { KakaoReadyDto } from './dto/kakao-ready.dto';
import { KakaoApproveDto } from './dto/kakao-approve.dto';
import { User } from '../entities/user.entity';
import crypto from 'crypto';

type KakaoReadyResponse = {
  tid: string;
  next_redirect_pc_url?: string;
  next_redirect_app_url?: string;
  next_redirect_mobile_url?: string;
  created_at?: string;
};

type KakaoApproveResponse = {
  aid: string;
  tid: string;
  cid: string;
  amount?: { total: number };
  approved_at?: string;
};

@Injectable()
export class PaymentsService {
  private readonly useMock: boolean;
  private readonly kakaoCid: string;
  private readonly kakaoAdminKey: string;
  private readonly approvalUrl: string;
  private readonly cancelUrl: string;
  private readonly failUrl: string;

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    private readonly dataSource: DataSource,
  ) {
    this.useMock = process.env.KAKAO_PAY_ENABLE !== 'true';
    this.kakaoCid = process.env.KAKAO_PAY_CID || 'TC0ONETIME';
    this.kakaoAdminKey = process.env.KAKAO_PAY_ADMIN_KEY || '';
    const baseRedirect = process.env.KAKAO_PAY_REDIRECT_BASE || 'http://localhost:3000';
    this.approvalUrl = `${baseRedirect}/api/payments/kakao/approve`; // 실제 콜백 라우트와 맞춰야 함
    this.cancelUrl = `${baseRedirect}/api/payments/kakao/cancel`;
    this.failUrl = `${baseRedirect}/api/payments/kakao/fail`;
  }

  private async ensureOrderForPayment(orderId: string, user: User) {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: { product: true, payment: true },
    });
    if (!order) throw new NotFoundException('ORDER_NOT_FOUND');
    if (order.userId !== user.id) throw new UnauthorizedException('ORDER_NOT_OWNED');
    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      throw new BadRequestException('ORDER_STATUS_NOT_PENDING_PAYMENT');
    }
    if (!order.product || order.product.productType !== ProductType.TIME_CAPSULE) {
      throw new NotFoundException('PRODUCT_NOT_FOUND_OR_INVALID');
    }
    return order;
  }

  private async callKakaoReady(
    order: Order,
    pgName: string,
  ): Promise<KakaoReadyResponse> {
    if (this.useMock) {
      const tid = `TID-${crypto.randomUUID()}`;
      return {
        tid,
        next_redirect_pc_url: `https://mock.kakao/redirect/${tid}`,
      };
    }

    if (!this.kakaoAdminKey) {
      throw new BadRequestException('KAKAO_PAY_ADMIN_KEY_REQUIRED');
    }

    const body = new URLSearchParams({
      cid: this.kakaoCid,
      partner_order_id: order.id,
      partner_user_id: order.userId,
      item_name: pgName,
      quantity: '1',
      total_amount: String(order.totalAmount),
      tax_free_amount: '0',
      approval_url: this.approvalUrl,
      cancel_url: this.cancelUrl,
      fail_url: this.failUrl,
    }).toString();

    const res = await fetch('https://kapi.kakao.com/v1/payment/ready', {
      method: 'POST',
      headers: {
        Authorization: `KakaoAK ${this.kakaoAdminKey}`,
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
      },
      body,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new BadRequestException(`KAKAO_READY_FAILED: ${text}`);
    }

    return (await res.json()) as KakaoReadyResponse;
  }

  private async callKakaoApprove(
    tid: string,
    pgToken: string,
    order: Order,
  ): Promise<KakaoApproveResponse> {
    if (this.useMock) {
      return {
        aid: crypto.randomUUID(),
        tid,
        cid: this.kakaoCid,
        amount: { total: order.totalAmount },
        approved_at: new Date().toISOString(),
      };
    }

    if (!this.kakaoAdminKey) {
      throw new BadRequestException('KAKAO_PAY_ADMIN_KEY_REQUIRED');
    }

    const body = new URLSearchParams({
      cid: this.kakaoCid,
      tid,
      partner_order_id: order.id,
      partner_user_id: order.userId,
      pg_token: pgToken,
    }).toString();

    const res = await fetch('https://kapi.kakao.com/v1/payment/approve', {
      method: 'POST',
      headers: {
        Authorization: `KakaoAK ${this.kakaoAdminKey}`,
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
      },
      body,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new BadRequestException(`KAKAO_APPROVE_FAILED: ${text}`);
    }

    return (await res.json()) as KakaoApproveResponse;
  }

  async kakaoReady(user: User, dto: KakaoReadyDto) {
    const order = await this.ensureOrderForPayment(dto.order_id, user);

    const existingPayment = await this.paymentRepository.findOne({
      where: { orderId: order.id },
    });
    if (
      existingPayment &&
      (existingPayment.status === PaymentStatus.READY ||
        existingPayment.status === PaymentStatus.PAID)
    ) {
      throw new ConflictException('PAYMENT_ALREADY_READY_OR_PAID');
    }

    const readyRes = await this.callKakaoReady(order, 'TIME_CAPSULE');
    const tid = readyRes.tid;
    if (!tid) {
      throw new BadRequestException('KAKAO_READY_NO_TID');
    }

    // payment upsert
    let payment = existingPayment;
    if (!payment) {
      payment = this.paymentRepository.create({
        orderId: order.id,
        pgTid: tid,
        amount: order.totalAmount,
        status: PaymentStatus.READY,
        pgRaw: readyRes,
      });
    }
    await this.paymentRepository.save(payment);

    const redirectUrl =
      readyRes.next_redirect_pc_url ||
      readyRes.next_redirect_app_url ||
      readyRes.next_redirect_mobile_url ||
      '';

    return {
      order_id: order.id,
      tid,
      redirect_url: redirectUrl,
    };
  }

  async kakaoApprove(user: User, dto: KakaoApproveDto) {
    const order = await this.ensureOrderForPayment(dto.order_id, user);

    const payment = await this.paymentRepository.findOne({
      where: { orderId: order.id },
    });
    if (!payment || !payment.pgTid) {
      throw new BadRequestException('PAYMENT_TID_NOT_FOUND');
    }
    if (payment.status === PaymentStatus.PAID || order.status === OrderStatus.PAID) {
      throw new BadRequestException('ORDER_ALREADY_PAID');
    }

    const approveRes = await this.callKakaoApprove(payment.pgTid, dto.pg_token, order);

    const approvedAt =
      approveRes.approved_at !== undefined
        ? new Date(approveRes.approved_at)
        : new Date();

    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(Payment).save({
        ...payment,
        status: PaymentStatus.PAID,
        approvedAt,
        amount: order.totalAmount,
        pgRaw: approveRes,
      });
      await manager.getRepository(Order).save({
        ...order,
        status: OrderStatus.PAID,
      });
    });

    return {
      order_id: order.id,
      status: OrderStatus.PAID,
      amount: order.totalAmount,
      approved_at: approvedAt.toISOString(),
    };
  }
}

