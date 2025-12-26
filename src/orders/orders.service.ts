import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../entities/order.entity';
import { Product, ProductType } from '../entities/product.entity';
import { User } from '../entities/user.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderStatus, TimeOption } from '../common/enums';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
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
    // 이미지(사진) 개수는 최대 10장까지 허용
    if (photoCount > 10) {
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
    const timeOptionAmount = this.calculateTimeOptionAmount(dto); // 기간별 요금
    const imageAmount = (dto.photo_count ?? 0) * 500; // 이미지 1장당 500원, 최대 10장
    const audioAmount = dto.add_music ? 1000 : 0; // 오디오 1개
    const videoAmount = dto.add_video ? 2000 : 0; // 영상 1개

    const totalAmount =
      timeOptionAmount + imageAmount + audioAmount + videoAmount;

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
      status: OrderStatus.PENDING_PAYMENT,
    });

    const saved = await this.orderRepository.save(order);
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
}
