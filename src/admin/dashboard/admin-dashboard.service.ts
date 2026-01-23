import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import {
  CapsuleAccessLog,
  CustomerService,
  Order,
  Payment,
  User,
} from '../../entities';
import { OrderStatus, PaymentStatus } from '../../common/enums';
import { AdminDashboardChartQueryDto } from './dto/admin-dashboard-chart-query.dto';
import { AdminOrderListQueryDto } from './dto/admin-order-list-query.dto';
import { AdminOrderStatusUpdateDto } from './dto/admin-order-status-update.dto';
import { AdminPaymentLogsQueryDto } from './dto/admin-payment-logs-query.dto';
import { AdminReceiptIssueDto } from './dto/admin-receipt-issue.dto';
import { AdminPaymentCancelDto } from './dto/admin-payment-cancel.dto';
import { AdminUserTrendsQueryDto } from './dto/admin-user-trends-query.dto';
import { PaymentsService } from '../../payments/payments.service';
import { CapsulesStepRoomService } from '../../capsules/capsules-step-room.service';

@Injectable()
export class AdminDashboardService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(CustomerService)
    private readonly customerServiceRepository: Repository<CustomerService>,
    @InjectRepository(CapsuleAccessLog)
    private readonly accessLogRepository: Repository<CapsuleAccessLog>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    private readonly paymentsService: PaymentsService,
    private readonly stepRoomService: CapsulesStepRoomService,
  ) {}

  async getSummary() {
    const start = this.startOfDay(new Date());
    const end = this.endOfDay(new Date());

    const signups = await this.userRepository.count({
      where: { createdAt: Between(start, end) },
    });

    const newInquiries = await this.customerServiceRepository.count({
      where: { createdAt: Between(start, end) },
    });

    const dauRaw = await this.accessLogRepository
      .createQueryBuilder('log')
      .select('COUNT(DISTINCT log.viewer_id)', 'count')
      .where('log.viewed_at BETWEEN :start AND :end', { start, end })
      .getRawOne<{ count: string }>();

    return {
      success: true,
      data: {
        signups,
        newInquiries,
        dau: Number(dauRaw?.count ?? 0),
      },
    };
  }

  async getCharts(query: AdminDashboardChartQueryDto) {
    const period = query.period ?? 'day';
    const { start, end } = this.resolveDateRange(
      period,
      query.startDate,
      query.endDate,
    );

    const signupRows = await this.userRepository
      .createQueryBuilder('user')
      .select(`DATE_TRUNC(:period, user.created_at)`, 'bucket')
      .addSelect('COUNT(*)', 'count')
      .where('user.created_at BETWEEN :start AND :end', { start, end })
      .setParameter('period', period)
      .groupBy('bucket')
      .orderBy('bucket', 'ASC')
      .getRawMany<{ bucket: Date; count: string }>();

    const paymentRows = await this.paymentRepository
      .createQueryBuilder('payment')
      .select(
        `DATE_TRUNC(:period, COALESCE(payment.approved_at, payment.created_at))`,
        'bucket',
      )
      .addSelect('COALESCE(SUM(payment.amount), 0)', 'amount')
      .where('payment.status = :status', { status: PaymentStatus.PAID })
      .andWhere(
        'COALESCE(payment.approved_at, payment.created_at) BETWEEN :start AND :end',
        { start, end },
      )
      .setParameter('period', period)
      .groupBy('bucket')
      .orderBy('bucket', 'ASC')
      .getRawMany<{ bucket: Date; amount: string }>();

    const signupMap = new Map(
      signupRows.map((row) => [
        this.formatBucket(new Date(row.bucket), period),
        Number(row.count),
      ]),
    );
    const revenueMap = new Map(
      paymentRows.map((row) => [
        this.formatBucket(new Date(row.bucket), period),
        Number(row.amount),
      ]),
    );

    const buckets = this.buildBuckets(period, start, end);
    const items = buckets.map((bucket) => ({
      period: bucket,
      signups: signupMap.get(bucket) ?? 0,
      revenue: revenueMap.get(bucket) ?? 0,
    }));

    return {
      success: true,
      data: {
        period,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        items,
      },
    };
  }

  async getUserTrends(query: AdminUserTrendsQueryDto) {
    const period = (query.period ?? '90d').toLowerCase();
    if (period !== '90d') {
      throw new BadRequestException('INVALID_PERIOD');
    }

    try {
      // UTC 기준으로 날짜 계산 (타임존 이슈 방지)
      const now = new Date();
      const end = this.endOfDay(now);
      const start = this.startOfDay(new Date(end));
      start.setDate(start.getDate() - 89);

      // 두 쿼리를 병렬로 실행하여 성능 최적화
      const [joinedRows, withdrawnRows] = await Promise.all([
        this.userRepository
          .createQueryBuilder('user')
          .withDeleted()
          .select('DATE(user.created_at)', 'date')
          .addSelect('COUNT(*)', 'count')
          .where('user.created_at BETWEEN :start AND :end', { start, end })
          .groupBy('date')
          .orderBy('date', 'ASC')
          .getRawMany<{ date: string | Date; count: string }>(),
        this.userRepository
          .createQueryBuilder('user')
          .withDeleted()
          .select('DATE(user.deleted_at)', 'date')
          .addSelect('COUNT(*)', 'count')
          .where('user.deleted_at IS NOT NULL')
          .andWhere('user.deleted_at BETWEEN :start AND :end', { start, end })
          .groupBy('date')
          .orderBy('date', 'ASC')
          .getRawMany<{ date: string | Date; count: string }>(),
      ]);

      const joinedMap = new Map(
        joinedRows.map((row) => [
          this.normalizeDateOnly(row.date),
          Number(row.count),
        ]),
      );
      const withdrawnMap = new Map(
        withdrawnRows.map((row) => [
          this.normalizeDateOnly(row.date),
          Number(row.count),
        ]),
      );

      const buckets = this.buildBuckets('day', start, end);
      const items = buckets.map((date) => ({
        date,
        joined: joinedMap.get(date) ?? 0,
        withdrawn: withdrawnMap.get(date) ?? 0,
      }));

      return {
        success: true,
        data: items,
      };
    } catch (error) {
      // 데이터베이스 쿼리 에러 처리
      if (error instanceof Error) {
        throw new BadRequestException(
          `Failed to fetch user trends: ${error.message}`,
        );
      }
      throw error;
    }
  }

  async getOrders(query: AdminOrderListQueryDto) {
    const qb = this.orderRepository
      .createQueryBuilder('orders')
      .leftJoinAndSelect('orders.product', 'product')
      .leftJoinAndSelect('orders.user', 'user')
      .leftJoinAndSelect('orders.payment', 'payment');

    if (query.status && query.status !== 'ALL') {
      qb.andWhere('orders.status = :status', { status: query.status });
    }

    if (query.paymentStatus && query.paymentStatus !== 'ALL') {
      qb.andWhere('payment.status = :paymentStatus', {
        paymentStatus: query.paymentStatus,
      });
    }

    if (query.userId) {
      qb.andWhere('orders.userId = :userId', { userId: query.userId });
    }

    if (query.userSearch) {
      // userSearch로 닉네임 또는 이메일로 User 검색
      const user = await this.userRepository.findOne({
        where: [{ nickname: query.userSearch }, { email: query.userSearch }],
      });

      if (!user) {
        // 사용자를 찾지 못한 경우 빈 결과 반환
        return {
          success: true,
          data: {
            items: [],
            total: 0,
            limit: query.limit,
            offset: query.offset,
          },
        };
      }

      qb.andWhere('orders.userId = :searchedUserId', {
        searchedUserId: user.id,
      });
    }

    if (query.startDate) {
      const start = new Date(query.startDate);
      start.setHours(0, 0, 0, 0);
      qb.andWhere('orders.createdAt >= :startDate', {
        startDate: start,
      });
    }
    if (query.endDate) {
      const end = new Date(query.endDate);
      end.setHours(23, 59, 59, 999);
      qb.andWhere('orders.createdAt <= :endDate', {
        endDate: end,
      });
    }

    const [items, total] = await qb
      .orderBy('orders.createdAt', 'DESC')
      .skip(query.offset)
      .take(query.limit)
      .getManyAndCount();

    return {
      success: true,
      data: {
        items: items.map((order) => ({
          order_id: order.id,
          order_status: order.status,
          total_amount: order.totalAmount,
          created_at: order.createdAt,
          product: {
            id: order.product?.id ?? null,
            name: order.product?.name ?? null,
            product_type: order.product?.productType ?? null,
          },
          payment: order.payment
            ? {
                id: order.payment.id,
                status: order.payment.status,
                amount: order.payment.amount,
                approved_at: order.payment.approvedAt,
                method: order.payment.method,
              }
            : null,
          user: order.user
            ? {
                id: order.user.id,
                nickname: order.user.nickname,
                email: order.user.email,
                phone_number: order.user.phoneNumber,
              }
            : null,
        })),
        total,
        limit: query.limit,
        offset: query.offset,
      },
    };
  }

  async getOrderDetail(orderId: string) {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: {
        product: true,
        user: true,
        payment: { cancels: true },
      },
    });

    if (!order) {
      throw new NotFoundException('ORDER_NOT_FOUND');
    }

    const payment = order.payment ?? null;
    const paymentMethod =
      payment?.method ?? (payment?.virtualAccount ? 'VIRTUAL_ACCOUNT' : null);

    return {
      success: true,
      data: {
        order: {
          id: order.id,
          status: order.status,
          total_amount: order.totalAmount,
          time_option: order.timeOption,
          custom_open_at: order.customOpenAt,
          headcount: order.headcount,
          photo_count: order.photoCount,
          add_music: order.addMusic,
          add_video: order.addVideo,
          capsule_title: order.capsuleTitle,
          created_at: order.createdAt,
          updated_at: order.updatedAt,
        },
        product: order.product
          ? {
              id: order.product.id,
              name: order.product.name,
              product_type: order.product.productType,
              price: order.product.price,
              description: order.product.description,
            }
          : null,
        user: order.user
          ? {
              id: order.user.id,
              nickname: order.user.nickname,
              email: order.user.email,
              phone_number: order.user.phoneNumber,
            }
          : null,
        payment: payment
          ? {
              id: payment.id,
              payment_key: payment.paymentKey,
              status: payment.status,
              amount: payment.amount,
              method: paymentMethod,
              approved_at: payment.approvedAt,
              receipt_url: payment.receiptUrl,
              cancels: payment.cancels ?? [],
            }
          : null,
      },
    };
  }

  async updateOrderStatus(orderId: string, dto: AdminOrderStatusUpdateDto) {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: { payment: true },
    });

    if (!order) {
      throw new NotFoundException('ORDER_NOT_FOUND');
    }

    this.validateStatusTransition(order.status, dto.status);

    const updated = await this.orderRepository.manager.transaction(
      async (manager) => {
        const orderRepo = manager.getRepository(Order);
        const paymentRepo = manager.getRepository(Payment);

        order.status = dto.status;
        order.updatedAt = new Date();
        const savedOrder = await orderRepo.save(order);

        if (order.payment) {
          if (dto.status === OrderStatus.PAID) {
            order.payment.status = PaymentStatus.PAID;
          } else if (dto.status === OrderStatus.CANCELED) {
            order.payment.status = PaymentStatus.CANCELED;
          } else if (dto.status === OrderStatus.FAILED) {
            order.payment.status = PaymentStatus.FAILED;
          }
          await paymentRepo.save(order.payment);
        }

        return savedOrder;
      },
    );

    if (dto.status === OrderStatus.PAID) {
      await this.stepRoomService.createCapsuleWithStepRoom(updated.id);
    }

    return {
      success: true,
      data: {
        order_id: updated.id,
        order_status: updated.status,
        updated_at: updated.updatedAt,
        payment_status: order.payment?.status ?? null,
      },
    };
  }

  async cancelPayment(paymentId: string, dto: AdminPaymentCancelDto) {
    return this.paymentsService.adminCancelPayment(paymentId, dto);
  }

  async getPaymentLogs(query: AdminPaymentLogsQueryDto) {
    const qb = this.paymentRepository
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.order', 'order')
      .leftJoinAndSelect('order.user', 'user');

    if (query.status && query.status !== 'ALL') {
      qb.andWhere('payment.status = :status', { status: query.status });
    }

    if (query.userId) {
      qb.andWhere('order.userId = :userId', { userId: query.userId });
    }

    if (query.startDate) {
      const start = new Date(query.startDate);
      start.setHours(0, 0, 0, 0);
      qb.andWhere('payment.createdAt >= :startDate', {
        startDate: start,
      });
    }
    if (query.endDate) {
      const end = new Date(query.endDate);
      end.setHours(23, 59, 59, 999);
      qb.andWhere('payment.createdAt <= :endDate', {
        endDate: end,
      });
    }

    const [items, total] = await qb
      .orderBy('payment.createdAt', 'DESC')
      .skip(query.offset)
      .take(query.limit)
      .getManyAndCount();

    return {
      success: true,
      data: {
        items: items.map((payment) => ({
          payment_id: payment.id,
          order_id: payment.orderId,
          payment_key: payment.paymentKey,
          status: payment.status,
          toss_status: payment.tossStatus,
          method: payment.method,
          fail_code: payment.failCode,
          fail_message: payment.failMessage,
          amount: payment.amount,
          requested_at: payment.requestedAt,
          approved_at: payment.approvedAt,
          created_at: payment.createdAt,
          user: payment.order?.user
            ? {
                id: payment.order.user.id,
                nickname: payment.order.user.nickname,
                email: payment.order.user.email,
                phone_number: payment.order.user.phoneNumber,
              }
            : null,
        })),
        total,
        limit: query.limit,
        offset: query.offset,
      },
    };
  }

  async issueReceipt(orderId: string, dto: AdminReceiptIssueDto) {
    if (dto.email) {
      // 이메일 전송 기능은 인프라 구성 전이므로 URL만 반환
    }
    return this.paymentsService.issueReceiptForOrder(orderId);
  }

  private validateStatusTransition(
    currentStatus: OrderStatus,
    newStatus: OrderStatus,
  ): void {
    if (currentStatus === newStatus) {
      return;
    }

    if (currentStatus === OrderStatus.PENDING_PAYMENT) {
      if (
        newStatus === OrderStatus.PAID ||
        newStatus === OrderStatus.CANCELED ||
        newStatus === OrderStatus.FAILED
      ) {
        return;
      }
    }

    if (currentStatus === OrderStatus.PAID) {
      if (newStatus === OrderStatus.CANCELED) {
        return;
      }
    }

    if (
      currentStatus === OrderStatus.CANCELED ||
      currentStatus === OrderStatus.FAILED
    ) {
      throw new BadRequestException(
        `INVALID_STATUS_TRANSITION: Cannot change from ${currentStatus} to ${newStatus}`,
      );
    }

    throw new BadRequestException(
      `INVALID_STATUS_TRANSITION: Cannot change from ${currentStatus} to ${newStatus}`,
    );
  }

  private resolveDateRange(
    period: 'day' | 'week' | 'month',
    startDate?: string,
    endDate?: string,
  ) {
    const now = new Date();
    const end = endDate ? this.endOfDay(new Date(endDate)) : this.endOfDay(now);

    if (startDate) {
      const start = this.startOfDay(new Date(startDate));
      return { start: this.alignStart(period, start), end };
    }

    const start = new Date(end);
    if (period === 'day') {
      start.setDate(start.getDate() - 29);
    } else if (period === 'week') {
      start.setDate(start.getDate() - 7 * 11);
    } else {
      start.setMonth(start.getMonth() - 11);
    }

    return { start: this.alignStart(period, this.startOfDay(start)), end };
  }

  private buildBuckets(
    period: 'day' | 'week' | 'month',
    start: Date,
    end: Date,
  ) {
    const buckets: string[] = [];
    const cursor = this.alignStart(period, new Date(start));

    while (cursor <= end) {
      buckets.push(this.formatBucket(cursor, period));
      if (period === 'day') {
        cursor.setDate(cursor.getDate() + 1);
      } else if (period === 'week') {
        cursor.setDate(cursor.getDate() + 7);
      } else {
        cursor.setMonth(cursor.getMonth() + 1, 1);
      }
      cursor.setHours(0, 0, 0, 0);
    }

    return buckets;
  }

  private formatBucket(date: Date, period: 'day' | 'week' | 'month') {
    if (period === 'month') {
      return date.toISOString().slice(0, 7);
    }
    return date.toISOString().slice(0, 10);
  }

  private normalizeDateOnly(value: string | Date) {
    if (value instanceof Date) {
      return this.formatBucket(value, 'day');
    }
    return value.slice(0, 10);
  }

  private startOfDay(date: Date) {
    const copy = new Date(date);
    copy.setHours(0, 0, 0, 0);
    return copy;
  }

  private startOfWeek(date: Date) {
    const copy = this.startOfDay(date);
    const day = copy.getDay(); // 0=Sun
    const diff = day === 0 ? -6 : 1 - day;
    copy.setDate(copy.getDate() + diff);
    return copy;
  }

  private startOfMonth(date: Date) {
    const copy = this.startOfDay(date);
    copy.setDate(1);
    return copy;
  }

  private alignStart(period: 'day' | 'week' | 'month', date: Date) {
    if (period === 'week') {
      return this.startOfWeek(date);
    }
    if (period === 'month') {
      return this.startOfMonth(date);
    }
    return this.startOfDay(date);
  }

  private endOfDay(date: Date) {
    const copy = new Date(date);
    copy.setHours(23, 59, 59, 999);
    return copy;
  }
}
