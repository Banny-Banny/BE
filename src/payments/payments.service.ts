/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  ConflictException,
  InternalServerErrorException,
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
import { CapsulesService } from '../capsules/capsules.service';
import { PaymentCancel } from '../entities/payment-cancel.entity';
import { TossConfirmDto } from './dto/toss-confirm.dto';
import { TossCancelDto } from './dto/toss-cancel.dto';
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
  private readonly useTossMock: boolean;
  private readonly kakaoCid: string;
  private readonly kakaoAdminKey: string;
  private readonly approvalUrl: string;
  private readonly cancelUrl: string;
  private readonly failUrl: string;
  private readonly tossSecretKey: string;
  private readonly tossBaseUrl: string;

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(PaymentCancel)
    private readonly paymentCancelRepository: Repository<PaymentCancel>,
    private readonly capsulesService: CapsulesService,
    private readonly dataSource: DataSource,
  ) {
    this.useMock = process.env.KAKAO_PAY_ENABLE !== 'true';
    this.useTossMock = process.env.TOSS_PAY_ENABLE !== 'true';
    this.kakaoCid = process.env.KAKAO_PAY_CID || 'TC0ONETIME';
    this.kakaoAdminKey = process.env.KAKAO_PAY_ADMIN_KEY || '';
    const baseRedirect =
      process.env.KAKAO_PAY_REDIRECT_BASE || 'http://localhost:3000';
    this.approvalUrl = `${baseRedirect}/api/payments/kakao/approve`; // 실제 콜백 라우트와 맞춰야 함
    this.cancelUrl = `${baseRedirect}/api/payments/kakao/cancel`;
    this.failUrl = `${baseRedirect}/api/payments/kakao/fail`;
    this.tossSecretKey = process.env.TOSS_SECRET_KEY || '';
    this.tossBaseUrl =
      process.env.TOSS_BASE_URL || 'https://api.tosspayments.com';
  }

  // =======================
  // Kakao Pay (추후 실연동 예정, 현재 목/기존 로직 유지)
  // =======================
  private async ensureOrderForPayment(orderId: string, user: User) {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: { product: true, payment: true },
    });
    if (!order) throw new NotFoundException('ORDER_NOT_FOUND');
    if (order.userId !== user.id) {
      throw new UnauthorizedException('ORDER_NOT_OWNED');
    }
    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      throw new BadRequestException('ORDER_STATUS_NOT_PENDING_PAYMENT');
    }
    if (
      !order.product ||
      order.product.productType !== ProductType.TIME_CAPSULE
    ) {
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
    if (
      payment.status === PaymentStatus.PAID ||
      order.status === OrderStatus.PAID
    ) {
      throw new BadRequestException('ORDER_ALREADY_PAID');
    }

    const approveRes = await this.callKakaoApprove(
      payment.pgTid,
      dto.pg_token,
      order,
    );

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

    const capsule = await this.capsulesService.createFromPaidOrder(order.id);

    return {
      order_id: order.id,
      status: OrderStatus.PAID,
      amount: order.totalAmount,
      approved_at: approvedAt.toISOString(),
      capsule_id: capsule.id,
    };
  }

  // =======================
  // Toss Payments
  // =======================
  private getTossAuthHeader() {
    if (this.useTossMock) return '';
    if (!this.tossSecretKey) {
      throw new BadRequestException('TOSS_SECRET_KEY_REQUIRED');
    }
    const encoded = Buffer.from(`${this.tossSecretKey}:`).toString('base64');
    return `Basic ${encoded}`;
  }

  private async callTossConfirm(dto: TossConfirmDto) {
    if (this.useTossMock) {
      const now = new Date();
      return {
        paymentKey: dto.paymentKey,
        orderId: dto.orderId,
        orderName: 'time-capsule',
        status: 'DONE',
        requestedAt: now.toISOString(),
        approvedAt: now.toISOString(),
        useEscrow: false,
        cultureExpense: false,
        card: {
          issuerCode: '71',
          acquirerCode: '71',
          number: '12345678****000*',
          installmentPlanMonths: 0,
          isInterestFree: false,
          interestPayer: null,
          approveNo: '00000000',
          useCardPoint: false,
          cardType: '신용',
          ownerType: '개인',
          acquireStatus: 'READY',
          amount: dto.amount,
        },
        virtualAccount: null,
        transfer: null,
        mobilePhone: null,
        giftCertificate: null,
        cashReceipt: null,
        cashReceipts: null,
        discount: null,
        cancels: null,
        secret: null,
        type: 'NORMAL',
        easyPay: null,
        country: 'KR',
        failure: null,
        isPartialCancelable: true,
        receipt: { url: 'https://mock.toss/receipt' },
        checkout: { url: 'https://mock.toss/checkout' },
        currency: 'KRW',
        totalAmount: dto.amount,
        balanceAmount: dto.amount,
        suppliedAmount: dto.amount,
        vat: 0,
        taxFreeAmount: 0,
        taxExemptionAmount: 0,
        method: '카드',
      };
    }
    const url = `${this.tossBaseUrl}/v1/payments/confirm`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: this.getTossAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        paymentKey: dto.paymentKey,
        orderId: dto.orderId,
        amount: dto.amount,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new BadRequestException(`TOSS_CONFIRM_FAILED: ${text}`);
    }
    return await res.json();
  }

  private async callTossGetByPaymentKey(paymentKey: string) {
    if (this.useTossMock) {
      // caller will handle DB lookup; mock path not used
      return null;
    }
    const url = `${this.tossBaseUrl}/v1/payments/${paymentKey}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: this.getTossAuthHeader(),
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new BadRequestException(`TOSS_GET_FAILED: ${text}`);
    }
    return await res.json();
  }

  private async callTossGetByOrderId(orderId: string) {
    if (this.useTossMock) {
      return null;
    }
    const url = `${this.tossBaseUrl}/v1/payments/orders/${orderId}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: this.getTossAuthHeader(),
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new BadRequestException(`TOSS_GET_FAILED: ${text}`);
    }
    return await res.json();
  }

  private async callTossCancel(dto: TossCancelDto) {
    if (this.useTossMock) {
      const now = new Date();
      return {
        paymentKey: dto.paymentKey,
        orderId: null,
        status: 'CANCELED',
        requestedAt: now.toISOString(),
        approvedAt: now.toISOString(),
        balanceAmount: 0,
        receipt: { url: 'https://mock.toss/receipt' },
        cancels: [
          {
            transactionKey: crypto.randomUUID(),
            cancelReason: dto.cancelReason,
            taxExemptionAmount: 0,
            canceledAt: now.toISOString(),
            transferDiscountAmount: 0,
            easyPayDiscountAmount: 0,
            receiptKey: null,
            cancelAmount: dto.cancelAmount ?? null,
            taxFreeAmount: 0,
            refundableAmount: 0,
            cancelStatus: 'DONE',
            cancelRequestId: null,
          },
        ],
      };
    }
    const url = `${this.tossBaseUrl}/v1/payments/${dto.paymentKey}/cancel`;
    const body: any = {
      cancelReason: dto.cancelReason,
    };
    if (dto.cancelAmount !== undefined) {
      body.cancelAmount = dto.cancelAmount;
    }
    if (dto.refundReceiveAccount) {
      body.refundReceiveAccount = dto.refundReceiveAccount;
    }
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: this.getTossAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new BadRequestException(`TOSS_CANCEL_FAILED: ${text}`);
    }
    return await res.json();
  }

  private mapTossPaymentToEntity(
    payment: Payment,
    toss: any,
    orderNo: string,
  ): Payment {
    payment.paymentKey = toss.paymentKey ?? payment.paymentKey ?? null;
    payment.orderNo = orderNo ?? payment.orderNo ?? null;
    payment.orderName = toss.orderName ?? null;
    payment.tossStatus = toss.status ?? null;
    payment.method = toss.method ?? null;
    payment.currency = toss.currency ?? payment.currency ?? 'KRW';
    payment.balanceAmount = toss.balanceAmount ?? null;
    payment.suppliedAmount = toss.suppliedAmount ?? null;
    payment.vat = toss.vat ?? null;
    payment.taxFreeAmount = toss.taxFreeAmount ?? null;
    payment.taxExemptionAmount = toss.taxExemptionAmount ?? null;
    payment.requestedAt = toss.requestedAt
      ? new Date(String(toss.requestedAt))
      : null;
    payment.approvedAt = toss.approvedAt
      ? new Date(String(toss.approvedAt))
      : null;
    payment.receiptUrl = toss.receipt?.url ?? null;
    payment.lastTransactionKey = toss.lastTransactionKey ?? null;
    payment.easyPayProvider = toss.easyPay?.provider ?? null;
    payment.cardMeta = toss.card ?? null;
    payment.virtualAccount = toss.virtualAccount ?? null;
    payment.failCode = toss.failure?.code ?? null;
    payment.failMessage = toss.failure?.message ?? null;
    payment.pgRaw = toss ?? null;
    payment.amount = toss.totalAmount ?? payment.amount ?? 0;
    return payment;
  }

  async tossConfirm(user: User, dto: TossConfirmDto) {
    const order = await this.orderRepository.findOne({
      where: { id: dto.orderId },
      relations: { product: true },
    });
    if (!order) {
      throw new NotFoundException('ORDER_NOT_FOUND');
    }
    if (order.userId !== user.id) {
      throw new UnauthorizedException('ORDER_NOT_OWNED');
    }
    if (order.status === OrderStatus.PAID) {
      throw new BadRequestException('ORDER_ALREADY_PAID');
    }
    if (
      !order.product ||
      order.product.productType !== ProductType.TIME_CAPSULE
    ) {
      throw new NotFoundException('PRODUCT_NOT_FOUND_OR_INVALID');
    }
    if (order.totalAmount !== dto.amount) {
      throw new BadRequestException('AMOUNT_MISMATCH');
    }

    const tossRes = await this.callTossConfirm(dto);

    const payment = await this.dataSource.transaction(async (manager) => {
      let pay = await manager.getRepository(Payment).findOne({
        where: { orderId: order.id },
      });
      if (!pay) {
        pay = manager.getRepository(Payment).create({
          orderId: order.id,
          pgTid: tossRes.paymentKey ?? crypto.randomUUID(),
          amount: order.totalAmount,
          status: PaymentStatus.READY,
        });
      }

      pay = this.mapTossPaymentToEntity(pay, tossRes, dto.orderId);
      pay.status = PaymentStatus.PAID;

      await manager.getRepository(Payment).save(pay);
      await manager.getRepository(Order).save({
        ...order,
        status: OrderStatus.PAID,
      });

      return pay;
    });

    const capsule = await this.capsulesService.createFromPaidOrder(order.id);

    return {
      order_id: order.id,
      payment_key: payment.paymentKey,
      status: OrderStatus.PAID,
      amount: payment.amount,
      approved_at: payment.approvedAt ?? null,
      capsule_id: capsule.id,
      receipt_url: payment.receiptUrl,
    };
  }

  async tossGetByPaymentKey(paymentKey: string) {
    const payment = await this.paymentRepository.findOne({
      where: { paymentKey },
      relations: { cancels: true },
    });
    if (!payment) {
      throw new NotFoundException('PAYMENT_NOT_FOUND');
    }
    return {
      payment,
      cancels: payment.cancels ?? [],
    };
  }

  async tossGetByOrderNo(orderNo: string) {
    const payment = await this.paymentRepository.findOne({
      where: { orderNo },
      relations: { cancels: true },
    });
    if (!payment) {
      throw new NotFoundException('PAYMENT_NOT_FOUND');
    }
    return {
      payment,
      cancels: payment.cancels ?? [],
    };
  }

  async tossCancel(user: User, dto: TossCancelDto) {
    const payment = await this.paymentRepository.findOne({
      where: { paymentKey: dto.paymentKey },
      relations: { order: true, cancels: true },
    });
    if (!payment) {
      throw new NotFoundException('PAYMENT_NOT_FOUND');
    }
    if (payment.order.userId !== user.id) {
      throw new UnauthorizedException('ORDER_NOT_OWNED');
    }

    const tossRes = await this.callTossCancel(dto);

    return this.dataSource.transaction(async (manager) => {
      const paymentRepo = manager.getRepository(Payment);
      const cancelRepo = manager.getRepository(PaymentCancel);

      let targetPayment = await paymentRepo.findOne({
        where: { id: payment.id },
      });
      if (!targetPayment) {
        throw new InternalServerErrorException('PAYMENT_NOT_LOADED');
      }

      targetPayment = this.mapTossPaymentToEntity(
        targetPayment,
        tossRes,
        payment.orderNo ?? String(tossRes.orderId ?? ''),
      );

      const isFullyCanceled =
        tossRes.status === 'CANCELED' ||
        tossRes.balanceAmount === 0 ||
        targetPayment.balanceAmount === 0;
      if (isFullyCanceled) {
        targetPayment.status = PaymentStatus.CANCELED;
      }

      await paymentRepo.save(targetPayment);

      const cancels = Array.isArray(tossRes.cancels) ? tossRes.cancels : [];
      for (const c of cancels) {
        const exists = await cancelRepo.findOne({
          where: { transactionKey: c.transactionKey },
        });
        if (exists) continue;
        const cancelAmount =
          c.cancelAmount ??
          dto.cancelAmount ??
          targetPayment.balanceAmount ??
          targetPayment.amount ??
          0;
        const entity = cancelRepo.create({
          paymentId: targetPayment.id,
          transactionKey: c.transactionKey,
          cancelAmount,
          cancelReason: c.cancelReason ?? null,
          cancelStatus: c.cancelStatus ?? null,
          canceledAt: c.canceledAt ? new Date(String(c.canceledAt)) : null,
          taxFreeAmount: c.taxFreeAmount ?? null,
          taxExemptionAmount: c.taxExemptionAmount ?? null,
          refundableAmount: c.refundableAmount ?? null,
          easyPayDiscountAmount: c.easyPayDiscountAmount ?? null,
          transferDiscountAmount: c.transferDiscountAmount ?? null,
          receiptKey: c.receiptKey ?? null,
          rawResponse: c,
        });
        await cancelRepo.save(entity);
      }

      return {
        payment_key: targetPayment.paymentKey,
        status: targetPayment.tossStatus ?? targetPayment.status,
        balance_amount: targetPayment.balanceAmount,
        cancels,
        receipt_url: targetPayment.receiptUrl,
      };
    });
  }
}
