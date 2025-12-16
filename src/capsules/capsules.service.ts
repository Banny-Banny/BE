import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Capsule } from '../entities/capsule.entity';
import { User } from '../entities/user.entity';
import { Product, ProductType } from '../entities/product.entity';
import { Friendship } from '../entities/friendship.entity';
import { FriendStatus } from '../common/enums';
import { CreateCapsuleDto } from './dto/create-capsule.dto';
import { MediaType } from '../common/enums';
import { GetCapsuleQueryDto } from './dto/get-capsule.dto';

@Injectable()
export class CapsulesService {
  constructor(
    @InjectRepository(Capsule)
    private readonly capsuleRepository: Repository<Capsule>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Friendship)
    private readonly friendshipRepository: Repository<Friendship>,
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

  private isWithinRadius(
    capsuleLat: number | null,
    capsuleLng: number | null,
    userLat?: number,
    userLng?: number,
    radiusMeters = 50,
  ): boolean {
    if (!capsuleLat || !capsuleLng) return true; // 위치 없는 캡슐은 위치 제약 없음
    if (userLat === undefined || userLng === undefined) return false;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const R = 6371e3;
    const phi1 = toRad(capsuleLat);
    const phi2 = toRad(userLat);
    const dPhi = toRad(userLat - capsuleLat);
    const dLambda = toRad(userLng - capsuleLng);
    const a =
      Math.sin(dPhi / 2) * Math.sin(dPhi / 2) +
      Math.cos(phi1) *
        Math.cos(phi2) *
        Math.sin(dLambda / 2) *
        Math.sin(dLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    return distance <= radiusMeters;
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

  async findOne(user: User, id: string, query: GetCapsuleQueryDto) {
    const capsule = await this.capsuleRepository.findOne({
      where: { id },
      relations: { product: true },
    });

    if (!capsule || capsule.deletedAt) {
      throw new NotFoundException('CAPSULE_NOT_FOUND');
    }

    // 친구 여부 확인
    const friend = await this.friendshipRepository.findOne({
      where: [
        {
          userId: user.id,
          friendId: capsule.userId,
          status: FriendStatus.CONNECTED,
        },
        {
          userId: capsule.userId,
          friendId: user.id,
          status: FriendStatus.CONNECTED,
        },
      ],
    });

    if (!friend) {
      throw new ForbiddenException('FORBIDDEN_FRIENDSHIP');
    }

    // 위치 검증
    const { lat, lng } = query;
    const within = this.isWithinRadius(
      capsule.latitude,
      capsule.longitude,
      lat,
      lng,
    );
    if (!within) {
      throw new ForbiddenException('FORBIDDEN_LOCATION');
    }

    const isLocked =
      capsule.openAt !== null && capsule.openAt.getTime() > Date.now();

    return {
      id: capsule.id,
      title: capsule.title,
      content: capsule.content,
      openAt: capsule.openAt,
      isLocked,
      viewLimit: capsule.viewLimit,
      viewCount: capsule.viewCount,
      mediaTypes: capsule.mediaTypes,
      mediaUrls: capsule.mediaUrls,
      product: capsule.product,
      latitude: capsule.latitude,
      longitude: capsule.longitude,
    } as Capsule;
  }
}
