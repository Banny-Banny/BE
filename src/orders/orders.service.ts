import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Order } from '../entities/order.entity';
import { Product, ProductType } from '../entities/product.entity';
import { User } from '../entities/user.entity';
import { Payment } from '../entities/payment.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderStatus, TimeOption, PaymentStatus } from '../common/enums';
import { CapsulesStepRoomService } from '../capsules/capsules-step-room.service';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    private readonly dataSource: DataSource,
    @Inject(forwardRef(() => CapsulesStepRoomService))
    private readonly stepRoomService: CapsulesStepRoomService,
  ) {}

  private validateDto(dto: CreateOrderDto) {
    const headcount = dto.headcount;
    if (headcount < 1 || headcount > 10) {
      throw new BadRequestException('HEADCOUNT_OUT_OF_RANGE');
    }

    const photoCount = dto.photo_count ?? 0;
    if (photoCount < 0) {
      throw new BadRequestException('PHOTO_COUNT_NEGATIVE');
    }
    const maxPhotos = 5; // 전체 최대 5장
    if (photoCount > maxPhotos) {
      throw new BadRequestException('PHOTO_COUNT_EXCEEDS_LIMIT');
    }

    if (dto.time_option === TimeOption.CUSTOM) {
      if (!dto.custom_open_at) {
        throw new BadRequestException('CUSTOM_OPEN_AT_REQUIRED');
      }
      const openAt = new Date(dto.custom_open_at);
      if (Number.isNaN(openAt.getTime()) || openAt.getTime() <= Date.now()) {
        throw new BadRequestException('CUSTOM_OPEN_AT_MUST_BE_FUTURE');
      }
    }
  }

  /**
   * 주문 상태 전환 검증
   * @param currentStatus 현재 주문 상태
   * @param newStatus 변경하려는 주문 상태
   * @throws BadRequestException 유효하지 않은 상태 전환인 경우
   */
  private validateStatusTransition(
    currentStatus: OrderStatus,
    newStatus: OrderStatus,
  ): void {
    // 동일한 상태로 변경하는 것은 허용
    if (currentStatus === newStatus) {
      return;
    }

    // PENDING_PAYMENT에서 허용되는 전환
    if (currentStatus === OrderStatus.PENDING_PAYMENT) {
      if (
        newStatus === OrderStatus.PAID ||
        newStatus === OrderStatus.CANCELED ||
        newStatus === OrderStatus.FAILED
      ) {
        return;
      }
    }

    // PAID에서 허용되는 전환
    if (currentStatus === OrderStatus.PAID) {
      if (newStatus === OrderStatus.CANCELED) {
        return;
      }
    }

    // CANCELED, FAILED는 변경 불가
    if (
      currentStatus === OrderStatus.CANCELED ||
      currentStatus === OrderStatus.FAILED
    ) {
      throw new BadRequestException(
        `INVALID_STATUS_TRANSITION: Cannot change from ${currentStatus} to ${newStatus}`,
      );
    }

    // 그 외의 모든 전환은 유효하지 않음
    throw new BadRequestException(
      `INVALID_STATUS_TRANSITION: Cannot change from ${currentStatus} to ${newStatus}`,
    );
  }

  private roundToHundred(amount: number): number {
    return Math.round(amount / 100) * 100;
  }

  private calculateTimeOptionAmount(dto: CreateOrderDto): number {
    const now = Date.now();
    const week = 1000; // 1주일
    const month = 5000; // 1개월
    const year = 10000; // 1년
    const twoYear = 20000; // 2년
    const threeYear = 30000; // 3년
    const maxStorageYears = 5;
    const maxStorageDays = maxStorageYears * 365;

    switch (dto.time_option) {
      case TimeOption.ONE_WEEK:
        return week;
      case TimeOption.ONE_MONTH:
        return month;
      case TimeOption.ONE_YEAR:
        return year;
      case TimeOption.TWO_YEAR:
        return twoYear;
      case TimeOption.THREE_YEAR:
        return threeYear;
      case TimeOption.CUSTOM: {
        const openAt = new Date(dto.custom_open_at!);
        const ms = openAt.getTime() - now;
        const days = Math.ceil(ms / (1000 * 60 * 60 * 24));
        if (days > maxStorageDays) {
          throw new BadRequestException('STORAGE_PERIOD_EXCEEDED');
        }
        // 연 단가(10,000원)를 일 단가로 환산 후 비례, 최소 1주 요금 보장, 100원 단위 반올림
        const perDay = year / 365;
        const dynamic = this.roundToHundred(perDay * days);
        return Math.max(week, dynamic);
      }
      default:
        return week;
    }
  }

  async create(user: User, dto: CreateOrderDto) {
    this.validateDto(dto);

    const product = await this.productRepository.findOne({
      where: { id: dto.product_id, isActive: true },
    });
    if (!product || product.productType !== ProductType.TIME_CAPSULE) {
      throw new NotFoundException('PRODUCT_NOT_FOUND_OR_INVALID');
    }

    // 금액 계산 (주문 단위)
    const timeOptionAmount = this.calculateTimeOptionAmount(dto); // 기간별 요금 (basePrice)
    const photoCount = dto.photo_count ?? 0;
    const imageAmount = dto.headcount * photoCount * 500; // 인원 × 이미지 갯수 × 500원
    const audioAmount = dto.add_music ? dto.headcount * 1000 : 0; // 인원 × 1,000원
    const videoAmount = dto.add_video ? dto.headcount * 2000 : 0; // 인원 × 2,000원

    const totalAmount =
      timeOptionAmount + imageAmount + audioAmount + videoAmount;

    // 테스트 환경에서는 바로 PAID 상태로 생성
    const skipPayment = process.env.SKIP_PAYMENT === 'true';
    const orderStatus = skipPayment
      ? OrderStatus.PAID
      : OrderStatus.PENDING_PAYMENT;

    const order = this.orderRepository.create({
      userId: user.id,
      productId: product.id,
      totalAmount,
      timeOption: dto.time_option,
      customOpenAt:
        dto.time_option === TimeOption.CUSTOM
          ? new Date(dto.custom_open_at!)
          : null,
      headcount: dto.headcount,
      photoCount: dto.photo_count ?? 0,
      addMusic: dto.add_music ?? false,
      addVideo: dto.add_video ?? false,
      status: orderStatus,
    });

    const saved = await this.orderRepository.save(order);

    // 테스트 환경에서는 바로 캡슐 생성
    if (skipPayment) {
      const capsule = await this.stepRoomService.createCapsuleWithStepRoom(
        saved.id,
      );

      // 참여 슬롯 조회 (current_participants 계산용)
      const currentParticipants = await this.dataSource
        .getRepository('capsule_participant_slots')
        .createQueryBuilder('slot')
        .where('slot.capsule_id = :capsuleId', { capsuleId: capsule.id })
        .andWhere('slot.user_id IS NOT NULL')
        .getCount();

      return {
        order_id: saved.id,
        total_amount: saved.totalAmount,
        time_option_amount: timeOptionAmount,
        image_amount: imageAmount,
        audio_amount: audioAmount,
        video_amount: videoAmount,
        time_option: saved.timeOption,
        custom_open_at: saved.customOpenAt,
        headcount: saved.headcount,
        photo_count: saved.photoCount,
        add_music: saved.addMusic,
        add_video: saved.addVideo,
        status: saved.status,
        // 테스트 모드에서는 캡슐 정보도 함께 반환
        capsule_id: capsule.id,
        invite_code: capsule.inviteCode,
        step_room: {
          room_id: capsule.id,
          invite_code: capsule.inviteCode,
          capsule_name: capsule.title,
          open_date: capsule.openAt,
          deadline: capsule.deadline,
          participant_count: capsule.viewLimit,
          current_participants: currentParticipants,
          created_at: capsule.createdAt,
        },
      };
    }

    // 일반 모드에서는 기존대로 주문 정보만 반환
    return {
      order_id: saved.id,
      total_amount: saved.totalAmount,
      time_option_amount: timeOptionAmount,
      image_amount: imageAmount,
      audio_amount: audioAmount,
      video_amount: videoAmount,
      time_option: saved.timeOption,
      custom_open_at: saved.customOpenAt,
      headcount: saved.headcount,
      photo_count: saved.photoCount,
      add_music: saved.addMusic,
      add_video: saved.addVideo,
      status: saved.status,
    };
  }

  async findOne(user: User, id: string) {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: { product: true, capsule: true },
    });

    if (!order) {
      throw new NotFoundException('ORDER_NOT_FOUND');
    }

    if (order.userId !== user.id) {
      throw new ForbiddenException('ORDER_NOT_OWNED');
    }

    const product = order.product;
    if (
      !product ||
      !product.isActive ||
      product.productType !== ProductType.TIME_CAPSULE
    ) {
      throw new NotFoundException('PRODUCT_NOT_FOUND_OR_INVALID');
    }

    return {
      order: {
        order_id: order.id,
        capsule_id: order.capsule ? order.capsule.id : null,
        invite_code: order.capsule ? order.capsule.inviteCode : null,
        status: order.status,
        total_amount: order.totalAmount,
        time_option: order.timeOption,
        custom_open_at: order.customOpenAt,
        headcount: order.headcount,
        photo_count: order.photoCount,
        add_music: order.addMusic,
        add_video: order.addVideo,
        created_at: order.createdAt,
        updated_at: order.updatedAt,
      },
      product: {
        id: product.id,
        product_type: product.productType,
        name: product.name,
        price: product.price,
        is_active: product.isActive,
        max_media_count: product.maxMediaCount,
        media_types: product.mediaTypes,
      },
    };
  }

  /**
   * 주문 상태 및 결제 정보 조회
   */
  async getStatus(user: User, orderId: string) {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('ORDER_NOT_FOUND');
    }

    if (order.userId !== user.id) {
      throw new ForbiddenException('ORDER_NOT_OWNED');
    }

    // 결제 정보 조회 (있으면 포함, 없으면 null)
    const payment = await this.paymentRepository.findOne({
      where: { orderId: order.id },
    });

    return {
      order_id: order.id,
      order_status: order.status,
      payment_status: payment ? payment.status : null,
      total_amount: order.totalAmount,
      payment_amount: payment ? payment.amount : null,
      payment_key: payment ? payment.paymentKey : null,
      approved_at: payment ? payment.approvedAt : null,
      created_at: order.createdAt,
      updated_at: order.updatedAt,
    };
  }

  /**
   * 결제 정보 상태 동기화
   */
  private async syncPaymentStatus(
    orderId: string,
    orderStatus: OrderStatus,
  ): Promise<void> {
    const payment = await this.paymentRepository.findOne({
      where: { orderId },
    });

    if (!payment) {
      // 결제 정보가 없으면 스킵
      return;
    }

    // 주문 상태에 따라 결제 상태 동기화
    if (orderStatus === OrderStatus.PAID) {
      payment.status = PaymentStatus.PAID;
    } else if (orderStatus === OrderStatus.CANCELED) {
      payment.status = PaymentStatus.CANCELED;
    } else if (orderStatus === OrderStatus.FAILED) {
      payment.status = PaymentStatus.FAILED;
    }

    await this.paymentRepository.save(payment);
  }

  /**
   * 주문 상태 변경
   */
  async updateStatus(
    user: User,
    orderId: string,
    status: OrderStatus,
  ): Promise<{
    order_id: string;
    order_status: OrderStatus;
    payment_status: PaymentStatus | null;
    updated_at: Date | null;
  }> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('ORDER_NOT_FOUND');
    }

    if (order.userId !== user.id) {
      throw new ForbiddenException('ORDER_NOT_OWNED');
    }

    // 상태 전환 검증
    this.validateStatusTransition(order.status, status);

    // 트랜잭션으로 주문 상태 업데이트 및 결제 정보 동기화
    const result = await this.dataSource.transaction(async (manager) => {
      // 주문 상태 업데이트
      order.status = status;
      order.updatedAt = new Date();
      const updatedOrder = await manager.getRepository(Order).save(order);

      // 결제 정보 동기화
      const payment = await manager.getRepository(Payment).findOne({
        where: { orderId: order.id },
      });

      let paymentStatus: PaymentStatus | null = null;
      if (payment) {
        if (status === OrderStatus.PAID) {
          payment.status = PaymentStatus.PAID;
        } else if (status === OrderStatus.CANCELED) {
          payment.status = PaymentStatus.CANCELED;
        } else if (status === OrderStatus.FAILED) {
          payment.status = PaymentStatus.FAILED;
        }
        await manager.getRepository(Payment).save(payment);
        paymentStatus = payment.status;
      }

      return {
        order_id: updatedOrder.id,
        order_status: updatedOrder.status,
        payment_status: paymentStatus,
        updated_at: updatedOrder.updatedAt,
      };
    });

    return result;
  }
}
