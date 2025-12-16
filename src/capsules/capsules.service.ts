import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Capsule } from '../entities/capsule.entity';
import { User } from '../entities/user.entity';
import { Product, ProductType } from '../entities/product.entity';
import { CreateCapsuleDto } from './dto/create-capsule.dto';
import { MediaType } from '../common/enums';

@Injectable()
export class CapsulesService {
  constructor(
    @InjectRepository(Capsule)
    private readonly capsuleRepository: Repository<Capsule>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  private validateMedia(
    mediaUrls: (string | null)[],
    mediaTypes: (MediaType | null)[],
    product: Product | null,
  ) {
    const maxLen = Math.max(mediaUrls.length, mediaTypes.length);
    if (maxLen > 3) {
      throw new BadRequestException('MEDIA_LIMIT_EXCEEDED');
    }

    const normalizedUrls: (string | null)[] = [];
    const normalizedTypes: MediaType[] = [];

    for (let i = 0; i < maxLen; i++) {
      const type = mediaTypes[i] ?? (i === 0 ? MediaType.TEXT : null);
      const url = mediaUrls[i] ?? null;

      if (type && type !== MediaType.TEXT && (!url || url.trim() === '')) {
        throw new BadRequestException('MEDIA_URL_REQUIRED_FOR_NON_TEXT');
      }
      if (type === null) {
        normalizedTypes.push(MediaType.TEXT);
      } else {
        normalizedTypes.push(type);
      }
      normalizedUrls.push(url);
    }

    if (product && product.productType === ProductType.EASTER_EGG) {
      const limit = product.maxMediaCount ?? 0;
      if (maxLen > limit) {
        throw new BadRequestException('MEDIA_COUNT_EXCEEDS_PRODUCT_LIMIT');
      }
      if (product.mediaTypes && product.mediaTypes.length > 0) {
        normalizedTypes.forEach((t) => {
          if (!product.mediaTypes!.includes(t)) {
            throw new BadRequestException('MEDIA_TYPE_NOT_ALLOWED_FOR_PRODUCT');
          }
        });
      }
    }

    return {
      mediaUrls: normalizedUrls.length ? normalizedUrls : null,
      mediaTypes: normalizedTypes.length ? normalizedTypes : null,
    };
  }

  async create(user: User, dto: CreateCapsuleDto): Promise<Capsule> {
    if (!user) {
      throw new ConflictException('USER_NOT_FOUND');
    }

    if (user.eggSlots <= 0) {
      throw new ConflictException('EGG_SLOTS_EXCEEDED');
    }

    let openAt: Date | null = null;
    if (dto.open_at) {
      openAt = new Date(dto.open_at);
      if (isNaN(openAt.getTime()) || openAt.getTime() <= Date.now()) {
        throw new BadRequestException('OPEN_AT_MUST_BE_FUTURE');
      }
    }

    const viewLimit = dto.view_limit ?? 0;
    if (viewLimit < 0) {
      throw new BadRequestException('VIEW_LIMIT_NEGATIVE');
    }

    let product: Product | null = null;
    if (dto.product_id) {
      product = await this.productRepository.findOne({
        where: { id: dto.product_id },
      });
      if (!product) {
        throw new NotFoundException('PRODUCT_NOT_FOUND');
      }
    }

    const mediaUrls = dto.media_urls ?? [];
    const mediaTypes = dto.media_types ?? [];
    const { mediaUrls: normalizedUrls, mediaTypes: normalizedTypes } =
      this.validateMedia(mediaUrls, mediaTypes, product);

    const capsule = new Capsule();
    capsule.userId = user.id;
    capsule.productId = dto.product_id ?? null;
    capsule.latitude = dto.latitude ?? null;
    capsule.longitude = dto.longitude ?? null;
    capsule.title = dto.title;
    capsule.content = dto.content ?? null;
    capsule.mediaUrls = normalizedUrls;
    capsule.mediaTypes = normalizedTypes;
    capsule.openAt = openAt;
    capsule.isLocked = true;
    capsule.viewLimit = viewLimit;

    return this.dataSource.transaction<Capsule>(async (manager) => {
      const userRepo = manager.getRepository(User);
      const targetUser = await userRepo.findOne({
        where: { id: user.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!targetUser) {
        throw new ConflictException('USER_NOT_FOUND');
      }
      if (targetUser.eggSlots <= 0) {
        throw new ConflictException('EGG_SLOTS_EXCEEDED');
      }
      targetUser.eggSlots -= 1;
      await userRepo.save(targetUser);

      const saved: Capsule = await manager.getRepository(Capsule).save(capsule);
      return saved;
    });
  }
}
