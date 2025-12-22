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
    // 사진 개수는 인당 최대 5장 → 총합은 headcount*5를 초과할 수 없음
    const maxPhotos = headcount * 5;
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

  private calculateAmount(dto: CreateOrderDto): number {
    const basePrice = 1000; // 1주 옵션 기본가를 baseline으로 적용
    const photoUnit = 500;
    const musicPrice = dto.add_music ? dto.headcount * 1000 : 0; // 인원당 1개 가능
    const videoPrice = dto.add_video ? dto.headcount * 2000 : 0; // 인원당 1개 가능

    const photoPrice = (dto.photo_count ?? 0) * photoUnit;
    return basePrice + photoPrice + musicPrice + videoPrice;
  }

  async create(user: User, dto: CreateOrderDto) {
    this.validateDto(dto);

    const product = await this.productRepository.findOne({
      where: { id: dto.product_id, isActive: true },
    });
    if (!product || product.productType !== ProductType.TIME_CAPSULE) {
      throw new NotFoundException('PRODUCT_NOT_FOUND_OR_INVALID');
    }

    const baseAmount = 1000;
    const photoAmount = (dto.photo_count ?? 0) * 500;
    const musicAmount = dto.add_music ? dto.headcount * 1000 : 0;
    const videoAmount = dto.add_video ? dto.headcount * 2000 : 0;
    const totalAmount = baseAmount + photoAmount + musicAmount + videoAmount;

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
      base_amount: baseAmount,
      photo_amount: photoAmount,
      music_amount: musicAmount,
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
      relations: { product: true },
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
