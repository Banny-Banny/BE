import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import {
  CapsuleAccessLog,
  CustomerService,
  Payment,
  User,
} from '../../entities';
import { PaymentStatus } from '../../common/enums';
import { AdminDashboardChartQueryDto } from './dto/admin-dashboard-chart-query.dto';

@Injectable()
export class AdminDashboardService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(CustomerService)
    private readonly customerServiceRepository: Repository<CustomerService>,
    @InjectRepository(CapsuleAccessLog)
    private readonly accessLogRepository: Repository<CapsuleAccessLog>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
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

  private buildBuckets(period: 'day' | 'week' | 'month', start: Date, end: Date) {
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
