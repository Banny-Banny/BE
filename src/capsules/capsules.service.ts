import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In, Repository, IsNull } from 'typeorm';
import { Capsule } from '../entities/capsule.entity';
import { User } from '../entities/user.entity';
import { Product, ProductType } from '../entities/product.entity';
import { Friendship } from '../entities/friendship.entity';
import { FriendStatus, OrderStatus, TimeOption } from '../common/enums';
import { CreateCapsuleDto } from './dto/create-capsule.dto';
import { MediaType } from '../common/enums';
import { GetCapsuleQueryDto } from './dto/get-capsule.dto';
import { GetCapsulesListQueryDto } from './dto/get-capsules-list.dto';
import {
  CapsuleAccessLog,
  CapsuleEntry,
  CapsuleParticipantSlot,
  Media,
  Order,
} from '../entities';
import { CreateCapsuleEntryDto } from './dto/create-capsule-entry.dto';
import { GetCapsuleSlotsResponseDto } from './dto/get-capsule-slots.dto';
import { MediaService } from '../media/media.service';
import { GetViewersResponseDto } from './dto/get-viewers-response.dto';
import { MulterFile } from '../media/types/multer-file.interface';
import { PushNotificationService } from '../common/services/push-notification.service';
import { NotificationType } from '../common/enums/notification-type.enum';

@Injectable()
export class CapsulesService {
  private readonly DEFAULT_MEDIA_LIMIT = 3;
  private readonly TEXT_BLOCK_MAX_COUNT = 5;
  private readonly TEXT_BLOCK_TOTAL_LIMIT = 2000;
  private readonly DEFAULT_EGG_SLOTS = 3;
  private readonly ENTRY_CONTENT_LIMIT = 2000;

  constructor(
    @InjectRepository(Capsule)
    private readonly capsuleRepository: Repository<Capsule>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Friendship)
    private readonly friendshipRepository: Repository<Friendship>,
    @InjectRepository(Media)
    private readonly mediaRepository: Repository<Media>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(CapsuleParticipantSlot)
    private readonly slotRepository: Repository<CapsuleParticipantSlot>,
    @InjectRepository(CapsuleEntry)
    private readonly entryRepository: Repository<CapsuleEntry>,
    @InjectRepository(CapsuleAccessLog)
    private readonly accessLogRepository: Repository<CapsuleAccessLog>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly mediaService: MediaService,
    private readonly pushNotificationService: PushNotificationService,
  ) {}

  private validateMedia(
    mediaUrls: (string | null)[],
    mediaTypes: (MediaType | null)[],
    product: Product | null,
  ) {
    const maxLen = Math.max(mediaUrls.length, mediaTypes.length);
    const limit = product?.maxMediaCount ?? this.DEFAULT_MEDIA_LIMIT;
    if (limit > 0 && maxLen > limit) {
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

  private validateTextBlocks(
    textBlocks?: { order: number; content: string }[],
  ) {
    if (!textBlocks || textBlocks.length === 0) {
      return null;
    }

    if (textBlocks.length > this.TEXT_BLOCK_MAX_COUNT) {
      throw new BadRequestException('TEXT_BLOCK_LIMIT_EXCEEDED');
    }

    const seen = new Set<number>();
    let totalLength = 0;
    const normalized = textBlocks.map((block) => {
      if (seen.has(block.order)) {
        throw new BadRequestException('TEXT_BLOCK_ORDER_DUPLICATED');
      }
      seen.add(block.order);
      const content = block.content?.trim() ?? '';
      if (!content) {
        throw new BadRequestException('TEXT_BLOCK_EMPTY');
      }
      totalLength += content.length;
      return {
        order: block.order,
        content,
      };
    });

    if (totalLength > this.TEXT_BLOCK_TOTAL_LIMIT) {
      throw new BadRequestException('TEXT_BLOCK_TOTAL_EXCEEDED');
    }

    return normalized.sort((a, b) => a.order - b.order);
  }

  private async resolveMediaByIds(
    user: User,
    mediaIds: string[],
    product: Product | null,
  ) {
    const uniqueIds = Array.from(new Set(mediaIds));
    if (uniqueIds.length === 0) {
      return {
        mediaItemIds: null as string[] | null,
        mediaTypes: null as (MediaType | null)[] | null,
        mediaEntities: [] as Media[],
      };
    }

    const limit = product?.maxMediaCount ?? this.DEFAULT_MEDIA_LIMIT;
    if (limit > 0 && uniqueIds.length > limit) {
      throw new BadRequestException('MEDIA_LIMIT_EXCEEDED');
    }

    const mediaEntities = await this.mediaRepository.find({
      where: { id: In(uniqueIds), userId: user.id },
    });

    if (mediaEntities.length !== uniqueIds.length) {
      throw new ForbiddenException('MEDIA_OWNERSHIP_MISMATCH');
    }

    if (product && product.mediaTypes && product.mediaTypes.length > 0) {
      mediaEntities.forEach((m) => {
        if (!product.mediaTypes!.includes(m.type)) {
          throw new BadRequestException('MEDIA_TYPE_NOT_ALLOWED_FOR_PRODUCT');
        }
      });
    }

    return {
      mediaItemIds: uniqueIds,
      mediaTypes: uniqueIds.map(
        (id) => mediaEntities.find((m) => m.id === id)!.type,
      ),
      mediaEntities,
    };
  }

  private isWithinRadius(
    capsuleLat: number | null,
    capsuleLng: number | null,
    userLat?: number,
    userLng?: number,
    radiusMeters = 300,
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

  private buildMediaItems(capsule: Capsule, mediaEntities?: Media[]) {
    const entityMap =
      mediaEntities?.reduce<Map<string, Media>>((map, m) => {
        map.set(m.id, m);
        return map;
      }, new Map()) ?? new Map<string, Media>();

    if (capsule.mediaItemIds && capsule.mediaItemIds.length > 0) {
      return capsule.mediaItemIds.map((id, idx) => {
        const entity = entityMap.get(id);
        const fallbackType =
          capsule.mediaTypes && idx < capsule.mediaTypes.length
            ? capsule.mediaTypes[idx]
            : null;
        const fallbackUrl =
          capsule.mediaUrls && idx < capsule.mediaUrls.length
            ? capsule.mediaUrls[idx]
            : null;
        return {
          media_id: id,
          type: entity?.type ?? fallbackType,
          object_key: entity?.objectKey ?? fallbackUrl ?? null,
        };
      });
    }

    const length = Math.max(
      capsule.mediaUrls?.length ?? 0,
      capsule.mediaTypes?.length ?? 0,
    );
    const items: {
      media_id: string | null;
      type: MediaType | null;
      object_key: string | null;
    }[] = [];
    for (let i = 0; i < length; i++) {
      items.push({
        media_id: null,
        type: capsule.mediaTypes?.[i] ?? null,
        object_key: capsule.mediaUrls?.[i] ?? null,
      });
    }
    return items;
  }

  private buildDistanceExpr(lat: number, lng: number) {
    // Haversine formula in meters (PostgreSQL compatible)
    // RADIANS(x) = x * PI() / 180
    const latRad = (lat * Math.PI) / 180;
    const lngRad = (lng * Math.PI) / 180;

    return `(
      6371000 * 2 * ASIN(
        SQRT(
          POWER(SIN((capsule.latitude::float * PI() / 180 - ${latRad}) / 2), 2) +
          COS(${latRad}) * 
          COS(capsule.latitude::float * PI() / 180) * 
          POWER(SIN((capsule.longitude::float * PI() / 180 - ${lngRad}) / 2), 2)
        )
      )
    )`;
  }

  private computeOpenAtFromTimeOption(
    timeOption: TimeOption,
    customOpenAt: Date | null,
  ): Date {
    const now = new Date();
    const dayMs = 24 * 60 * 60 * 1000;
    switch (timeOption) {
      case TimeOption.ONE_WEEK:
        return new Date(now.getTime() + 7 * dayMs);
      case TimeOption.ONE_MONTH:
        return new Date(now.getTime() + 30 * dayMs);
      case TimeOption.ONE_YEAR:
        return new Date(now.getTime() + 365 * dayMs);
      case TimeOption.TWO_YEAR:
        return new Date(now.getTime() + 730 * dayMs);
      case TimeOption.THREE_YEAR:
        return new Date(now.getTime() + 1095 * dayMs);
      case TimeOption.CUSTOM: {
        if (!customOpenAt) {
          throw new BadRequestException('CUSTOM_OPEN_AT_REQUIRED');
        }
        const parsed = new Date(customOpenAt);
        if (Number.isNaN(parsed.getTime()) || parsed.getTime() <= Date.now()) {
          throw new BadRequestException('CUSTOM_OPEN_AT_INVALID');
        }
        return parsed;
      }
      default:
        throw new BadRequestException('TIME_OPTION_NOT_SUPPORTED');
    }
  }

  async resetEggSlots(user: User): Promise<number> {
    if (!user) {
      throw new ConflictException('USER_NOT_FOUND');
    }

    const slots = await this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      const capsuleRepo = manager.getRepository(Capsule);
      const entryRepo = manager.getRepository(CapsuleEntry);
      const slotRepo = manager.getRepository(CapsuleParticipantSlot);
      const accessLogRepo = manager.getRepository(CapsuleAccessLog);

      // 1. 사용자 조회 및 잠금
      const targetUser = await userRepo.findOne({
        where: { id: user.id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!targetUser) {
        throw new ConflictException('USER_NOT_FOUND');
      }

      // 2. 사용자가 작성한 모든 캡슐 조회 (삭제되지 않은 것만)
      const userCapsules = await capsuleRepo.find({
        where: {
          userId: user.id,
          deletedAt: IsNull(),
        },
      });

      if (userCapsules.length > 0) {
        const capsuleIds = userCapsules.map((c) => c.id);

        // 3. 관련 데이터 삭제
        // 3-1. CapsuleEntry 삭제
        await entryRepo.delete({
          capsuleId: In(capsuleIds),
        });

        // 3-2. CapsuleParticipantSlot 삭제
        await slotRepo.delete({
          capsuleId: In(capsuleIds),
        });

        // 3-3. CapsuleAccessLog 삭제
        await accessLogRepo.delete({
          capsuleId: In(capsuleIds),
        });

        // 3-4. 캡슐 소프트 삭제
        await capsuleRepo.softDelete({
          id: In(capsuleIds),
        });
      }

      // 4. eggSlots를 기본값(3)으로 초기화
      targetUser.eggSlots = this.DEFAULT_EGG_SLOTS;
      const saved = await userRepo.save(targetUser);
      return saved.eggSlots;
    });

    return slots;
  }

  async create(
    user: User,
    dto: CreateCapsuleDto,
    files?: MulterFile[],
  ): Promise<Capsule> {
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

    // 이스터에그 생성 시 위도/경도 필수 검증
    const isEasterEgg =
      !product || product.productType === ProductType.EASTER_EGG;
    if (isEasterEgg) {
      if (dto.latitude === undefined || dto.latitude === null) {
        throw new BadRequestException('LATITUDE_REQUIRED_FOR_EASTER_EGG');
      }
      if (dto.longitude === undefined || dto.longitude === null) {
        throw new BadRequestException('LONGITUDE_REQUIRED_FOR_EASTER_EGG');
      }
    }

    const textBlocks = this.validateTextBlocks(dto.text_blocks);

    // 미디어 처리: 파일 업로드 또는 기존 media_ids 사용
    let mediaItemIds: string[] | null = null;
    let resolvedMediaTypes: (MediaType | null)[] | null = null;

    if (files && files.length > 0) {
      // form-data로 파일이 넘어온 경우: 직접 업로드
      const uploadedMedia: Media[] = [];
      for (const file of files) {
        const type = this.mediaService.resolveMediaTypeFromMimetype(
          file.mimetype,
        );
        const media = await this.mediaService.uploadMulterFile(
          user.id,
          file,
          type,
        );
        uploadedMedia.push(media);
      }

      // 업로드된 미디어 검증
      const limit = product?.maxMediaCount ?? this.DEFAULT_MEDIA_LIMIT;
      if (limit > 0 && uploadedMedia.length > limit) {
        throw new BadRequestException('MEDIA_LIMIT_EXCEEDED');
      }

      if (product && product.mediaTypes && product.mediaTypes.length > 0) {
        uploadedMedia.forEach((m) => {
          if (!product.mediaTypes!.includes(m.type)) {
            throw new BadRequestException('MEDIA_TYPE_NOT_ALLOWED_FOR_PRODUCT');
          }
        });
      }

      mediaItemIds = uploadedMedia.map((m) => m.id);
      resolvedMediaTypes = uploadedMedia.map((m) => m.type);
    } else if (dto.media_ids && dto.media_ids.length > 0) {
      // 기존 방식: media_ids 사용
      const resolved = await this.resolveMediaByIds(
        user,
        dto.media_ids,
        product,
      );
      mediaItemIds = resolved.mediaItemIds;
      resolvedMediaTypes = resolved.mediaTypes;
    }

    const capsule = new Capsule();
    capsule.userId = user.id;
    capsule.productId = dto.product_id ?? null;
    capsule.latitude = dto.latitude ?? null;
    capsule.longitude = dto.longitude ?? null;
    capsule.title = dto.title;
    capsule.content = dto.content ?? null;
    capsule.mediaUrls = null;
    capsule.mediaItemIds = mediaItemIds;
    capsule.mediaTypes = resolvedMediaTypes;
    capsule.openAt = openAt;
    capsule.isLocked = true;
    capsule.viewLimit = viewLimit;
    capsule.textBlocks = textBlocks;

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
      return {
        ...saved,
        mediaItems: this.buildMediaItems(saved),
      } as Capsule;
    });
  }

  async findOne(user: User, id: string, query: GetCapsuleQueryDto) {
    const capsule = await this.capsuleRepository.findOne({
      where: { id },
      relations: { product: true, user: true },
    });

    if (!capsule || capsule.deletedAt) {
      throw new NotFoundException('CAPSULE_NOT_FOUND');
    }

    // 본인 캡슐 여부 확인
    const isMine = capsule.userId === user.id;

    // 본인 캡슐이 아닌 경우에만 친구 여부 확인
    if (!isMine) {
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
    }

    // 본인 캡슐이 아닌 경우에만 위치 검증
    if (!isMine) {
      const { lat, lng } = query;
      // PostgreSQL decimal 타입을 number로 변환
      const capsuleLat =
        capsule.latitude !== null ? Number(capsule.latitude) : null;
      const capsuleLng =
        capsule.longitude !== null ? Number(capsule.longitude) : null;

      const within = this.isWithinRadius(capsuleLat, capsuleLng, lat, lng);
      if (!within) {
        throw new ForbiddenException('FORBIDDEN_LOCATION');
      }
    }

    const isLocked =
      capsule.openAt !== null && capsule.openAt.getTime() > Date.now();

    const mediaEntities =
      capsule.mediaItemIds && capsule.mediaItemIds.length > 0
        ? await this.mediaRepository.find({
            where: { id: In(capsule.mediaItemIds) },
          })
        : [];
    const mediaItems = this.buildMediaItems(capsule, mediaEntities);

    // 조회 로그 기록 (본인 캡슐이 아닌 경우만)
    if (capsule.userId !== user.id) {
      await this.logCapsuleAccess(capsule.id, user.id);
    }

    // 조회자 목록 조회 (작성자 본인 제외)
    const accessLogs = await this.accessLogRepository.find({
      where: { capsuleId: capsule.id },
      relations: { viewer: true },
      order: { viewedAt: 'ASC' },
    });

    const viewers = accessLogs
      .filter((log) => log.viewerId !== capsule.userId)
      .map((log) => ({
        id: log.viewer.id,
        nickname: log.viewer.nickname,
        profile_img: log.viewer.profileImg,
        viewed_at: log.viewedAt,
      }));

    // 작성자 정보
    const author = capsule.user
      ? {
          id: capsule.user.id,
          nickname: capsule.user.nickname,
          profile_img: capsule.user.profileImg,
        }
      : null;

    return {
      id: capsule.id,
      title: capsule.title,
      content: isLocked ? null : capsule.content,
      open_at: capsule.openAt,
      is_locked: isLocked,
      view_limit: capsule.viewLimit,
      view_count: capsule.viewCount,
      media_items: mediaItems,
      product: capsule.product,
      latitude: capsule.latitude,
      longitude: capsule.longitude,
      text_blocks: isLocked ? null : capsule.textBlocks,
      author,
      viewers,
      created_at: capsule.createdAt,
    };
  }

  /**
   * 알 상세 정보 조회 (신규 형식)
   */
  async getEggDetail(user: User, eggId: string) {
    const capsule = await this.capsuleRepository.findOne({
      where: { id: eggId },
      relations: { product: true, user: true },
      withDeleted: true, // soft delete된 캡슐도 조회 가능 (본인이 심은 소멸된 알)
    });

    if (!capsule) {
      throw new NotFoundException('CAPSULE_NOT_FOUND');
    }

    // 본인 캡슐 여부 확인
    const isMine = capsule.userId === user.id;

    // 본인 캡슐이 아닌 경우 소멸된 캡슐은 조회 불가
    if (!isMine && capsule.deletedAt) {
      throw new NotFoundException('CAPSULE_NOT_FOUND');
    }

    // 친구 관계 검증 및 위치 검증 제거 - 단순히 ID로 조회

    // 미디어 정보 조회
    const mediaEntities =
      capsule.mediaItemIds && capsule.mediaItemIds.length > 0
        ? await this.mediaRepository.find({
            where: { id: In(capsule.mediaItemIds) },
          })
        : [];

    const mediaMap = new Map(mediaEntities.map((m) => [m.id, m]));

    // 미디어 타입별로 분리
    let imageMediaId: string | null = null;
    let imageObjectKey: string | null = null;
    let audioMediaId: string | null = null;
    let audioObjectKey: string | null = null;
    let videoMediaId: string | null = null;
    let videoObjectKey: string | null = null;

    if (capsule.mediaItemIds && capsule.mediaItemIds.length > 0) {
      for (let i = 0; i < capsule.mediaItemIds.length; i++) {
        const mediaId = capsule.mediaItemIds[i];
        const media = mediaMap.get(mediaId);
        const mediaType = media?.type ?? capsule.mediaTypes?.[i];

        if (mediaType === MediaType.IMAGE && !imageMediaId) {
          imageMediaId = mediaId;
          imageObjectKey = media?.objectKey ?? null;
        } else if (mediaType === MediaType.AUDIO && !audioMediaId) {
          audioMediaId = mediaId;
          audioObjectKey = media?.objectKey ?? null;
        } else if (mediaType === MediaType.VIDEO && !videoMediaId) {
          videoMediaId = mediaId;
          videoObjectKey = media?.objectKey ?? null;
        }
      }
    }

    // 조회 로그 기록 (본인 캡슐이 아닌 경우만)
    if (!isMine) {
      await this.logCapsuleAccess(capsule.id, user.id);
    }

    // 조회자 목록 조회 (작성자 본인 제외)
    const accessLogs = await this.accessLogRepository.find({
      where: { capsuleId: capsule.id },
      relations: { viewer: true },
      order: { viewedAt: 'ASC' },
    });

    const viewers = accessLogs
      .filter((log) => log.viewerId !== capsule.userId)
      .map((log) => ({
        id: log.viewer.id,
        nickname: log.viewer.nickname,
        profileImg: log.viewer.profileImg,
        viewedAt: log.viewedAt,
      }));

    // 작성자 정보
    const author = {
      id: capsule.user.id,
      nickname: capsule.user.nickname,
      profileImg: capsule.user.profileImg,
    };

    // type 결정: 본인이 발견한 알인지 확인
    let type: 'FOUND' | 'PLANTED' = 'PLANTED';
    let foundAt: Date | null = null;

    if (!isMine) {
      // 다른 사람의 알이므로 FOUND
      type = 'FOUND';
      const myAccessLog = accessLogs.find((log) => log.viewerId === user.id);
      foundAt = myAccessLog ? myAccessLog.viewedAt : null;
    }

    return {
      eggId: capsule.id,
      type,
      isMine,
      title: capsule.title,
      message: capsule.content,
      imageMediaId,
      imageObjectKey,
      audioMediaId,
      audioObjectKey,
      videoMediaId,
      videoObjectKey,
      location: {
        address: null,
        latitude: capsule.latitude ? Number(capsule.latitude) : null,
        longitude: capsule.longitude ? Number(capsule.longitude) : null,
      },
      author,
      createdAt: capsule.createdAt,
      foundAt,
      expiredAt: capsule.deletedAt,
      discoveredCount: viewers.length,
      viewers,
    };
  }

  async findNearby(user: User, query: GetCapsulesListQueryDto) {
    // user 검증
    if (!user || !user.id) {
      throw new BadRequestException('USER_REQUIRED');
    }

    const {
      lat,
      lng,
      radius_m = 300,
      limit = 50,
      include_locationless = false,
      include_consumed = false,
    } = query;

    // lat/lng 검증 추가
    if (lat === undefined || lat === null || isNaN(lat)) {
      throw new BadRequestException('INVALID_LATITUDE');
    }
    if (lng === undefined || lng === null || isNaN(lng)) {
      throw new BadRequestException('INVALID_LONGITUDE');
    }
    if (lat < -90 || lat > 90) {
      throw new BadRequestException('LATITUDE_OUT_OF_RANGE');
    }
    if (lng < -180 || lng > 180) {
      throw new BadRequestException('LONGITUDE_OUT_OF_RANGE');
    }

    if (radius_m < 10 || radius_m > 5000) {
      throw new BadRequestException('RADIUS_OUT_OF_RANGE');
    }
    if (limit < 1 || limit > 200) {
      throw new BadRequestException('LIMIT_OUT_OF_RANGE');
    }

    const qb = this.capsuleRepository
      .createQueryBuilder('capsule')
      .leftJoinAndSelect('capsule.product', 'product')
      .where('capsule.deleted_at IS NULL')
      .andWhere('(product.id IS NULL OR product.isActive = true)')
      .andWhere(
        `(
          -- 이스터에그: 본인 것 또는 친구 것
          (
            (product.product_type = :easterEggType OR product.id IS NULL)
            AND (
              capsule.user_id = :userId
              OR EXISTS (SELECT 1 FROM friendships f WHERE f.user_id = :userId AND f.friend_id = capsule.user_id AND f.status = :status)
              OR EXISTS (SELECT 1 FROM friendships fr WHERE fr.user_id = capsule.user_id AND fr.friend_id = :userId AND fr.status = :status)
            )
          )
          -- 타임캡슐: 본인 것 또는 본인이 참여 중인 것
          OR (
            product.product_type = :timeCapsuleType
            AND (
              capsule.user_id = :userId
              OR EXISTS (SELECT 1 FROM capsule_participant_slots s WHERE s.capsule_id = capsule.id AND s.user_id = :userId)
            )
          )
        )`,
        {
          userId: user.id,
          status: FriendStatus.CONNECTED,
          easterEggType: ProductType.EASTER_EGG,
          timeCapsuleType: ProductType.TIME_CAPSULE,
        },
      );

    if (!include_locationless) {
      qb.andWhere(
        'capsule.latitude IS NOT NULL AND capsule.longitude IS NOT NULL',
      );
    }

    qb.andWhere(
      `(capsule.latitude IS NULL OR capsule.longitude IS NULL OR ${this.buildDistanceExpr(
        lat,
        lng,
      )} <= :radius_m)`,
      { radius_m },
    );

    if (!include_consumed) {
      qb.andWhere(
        '(capsule.view_limit = 0 OR capsule.view_count < capsule.view_limit)',
      );
    }

    qb.take(limit + 1);

    const entities = await qb.getMany();
    const sliceEntities = entities.slice(0, limit);
    const items = sliceEntities.map((capsule) => {
      // PostgreSQL decimal 타입은 string으로 반환되므로 number로 변환
      const capsuleLat =
        capsule.latitude !== null ? Number(capsule.latitude) : null;
      const capsuleLng =
        capsule.longitude !== null ? Number(capsule.longitude) : null;

      const distance =
        capsuleLat !== null &&
        capsuleLng !== null &&
        !isNaN(capsuleLat) &&
        !isNaN(capsuleLng) &&
        this.isWithinRadius(
          capsuleLat,
          capsuleLng,
          lat,
          lng,
          Number.MAX_SAFE_INTEGER,
        )
          ? (() => {
              const toRad = (deg: number) => (deg * Math.PI) / 180;
              const R = 6371e3;
              const phi1 = toRad(capsuleLat);
              const phi2 = toRad(lat);
              const dPhi = toRad(lat - capsuleLat);
              const dLambda = toRad(lng - capsuleLng);
              const a =
                Math.sin(dPhi / 2) * Math.sin(dPhi / 2) +
                Math.cos(phi1) *
                  Math.cos(phi2) *
                  Math.sin(dLambda / 2) *
                  Math.sin(dLambda / 2);
              const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
              return R * c;
            })()
          : null;
      const canOpen =
        capsule.viewLimit === 0 || capsule.viewCount < capsule.viewLimit;
      const isLocked =
        capsule.openAt !== null && capsule.openAt.getTime() > Date.now();
      const mediaItems = this.buildMediaItems(capsule);

      // type 필드 결정: product가 있으면 productType 사용, 없으면 기본값 EASTER_EGG
      const capsuleType =
        capsule.product?.productType ?? ProductType.EASTER_EGG;
      // 본인 캡슐 여부 확인
      const isMine = capsule.userId === user.id;

      return {
        id: capsule.id,
        title: capsule.title,
        content: isLocked ? null : capsule.content,
        open_at: capsule.openAt,
        is_locked: isLocked,
        view_limit: capsule.viewLimit,
        view_count: capsule.viewCount,
        can_open: canOpen,
        latitude: capsuleLat,
        longitude: capsuleLng,
        distance_m:
          distance !== null && Number.isFinite(distance)
            ? Math.round(distance * 10) / 10
            : null,
        type: capsuleType,
        is_mine: isMine,
        media_items: mediaItems,
        product: capsule.product
          ? {
              id: capsule.product.id,
              product_type: capsule.product.productType,
              max_media_count: capsule.product.maxMediaCount,
              media_types: capsule.product.mediaTypes,
            }
          : null,
        text_blocks: isLocked ? null : capsule.textBlocks,
      };
    });

    return {
      items,
      page_info: null,
    };
  }

  async createFromPaidOrder(orderId: string): Promise<Capsule> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: { product: true, capsule: true },
    });

    if (!order) {
      throw new NotFoundException('ORDER_NOT_FOUND');
    }

    if (order.status !== OrderStatus.PAID) {
      throw new BadRequestException('ORDER_NOT_PAID');
    }

    if (
      !order.product ||
      !order.product.isActive ||
      order.product.productType !== ProductType.TIME_CAPSULE
    ) {
      throw new NotFoundException('PRODUCT_NOT_FOUND_OR_INVALID');
    }

    if (order.headcount < 1 || order.headcount > 10) {
      throw new BadRequestException('HEADCOUNT_OUT_OF_RANGE');
    }

    if (order.capsule && order.capsule.orderId === order.id) {
      return order.capsule;
    }

    const openAt = this.computeOpenAtFromTimeOption(
      order.timeOption,
      order.customOpenAt,
    );

    const product = order.product;
    const requestedMediaCount =
      (order.photoCount ?? 0) +
      (order.addMusic ? 1 : 0) +
      (order.addVideo ? 1 : 0);

    if (product.maxMediaCount !== null && product.maxMediaCount !== undefined) {
      if (requestedMediaCount > product.maxMediaCount) {
        throw new BadRequestException('MEDIA_COUNT_EXCEEDS_PRODUCT_LIMIT');
      }
    }

    if (product.mediaTypes && product.mediaTypes.length > 0) {
      const requiredTypes: MediaType[] = [];
      if (order.photoCount > 0) {
        requiredTypes.push(MediaType.IMAGE);
      }
      if (order.addVideo) {
        requiredTypes.push(MediaType.VIDEO);
      }
      if (order.addMusic) {
        requiredTypes.push(MediaType.AUDIO);
      }
      requiredTypes.forEach((t) => {
        if (!product.mediaTypes!.includes(t)) {
          throw new BadRequestException('MEDIA_TYPE_NOT_ALLOWED_FOR_PRODUCT');
        }
      });
    }

    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Capsule);
      const existing = await repo.findOne({ where: { orderId: order.id } });
      if (existing) {
        return existing;
      }

      const capsule = repo.create({
        userId: order.userId,
        productId: order.productId,
        orderId: order.id,
        latitude: null,
        longitude: null,
        title: 'My Time Capsule',
        content: null,
        mediaUrls: null,
        mediaItemIds: null,
        mediaTypes: null,
        textBlocks: null,
        openAt,
        isLocked: true,
        viewLimit: order.headcount,
        viewCount: 0,
      });

      const saved = await repo.save(capsule);
      return saved;
    });
  }

  /**
   * 결제 완료된 캡슐 컨텍스트 조회 (공통 메서드)
   * @public - 다른 서비스에서도 사용 가능
   */
  async ensurePaidCapsuleContext(capsuleId: string) {
    const capsule = await this.capsuleRepository.findOne({
      where: { id: capsuleId },
      relations: { order: true, product: true },
    });

    if (!capsule || capsule.deletedAt) {
      throw new NotFoundException('CAPSULE_NOT_FOUND');
    }

    if (!capsule.order || capsule.order.status !== OrderStatus.PAID) {
      throw new ForbiddenException('CAPSULE_PAYMENT_REQUIRED');
    }

    if (capsule.order.headcount < 1) {
      throw new BadRequestException('HEADCOUNT_INVALID');
    }

    return {
      capsule,
      order: capsule.order,
      product: capsule.product ?? null,
      headcount: capsule.order.headcount,
    };
  }

  /**
   * 참여자 수 조회 (공통 메서드)
   * @public - 다른 서비스에서도 사용 가능
   */
  async getCurrentParticipantsCount(capsuleId: string): Promise<number> {
    return await this.slotRepository
      .createQueryBuilder('slot')
      .where('slot.capsule_id = :capsuleId', { capsuleId })
      .andWhere('slot.user_id IS NOT NULL')
      .getCount();
  }

  private async ensureSlotsCreated(capsuleId: string, headcount: number) {
    const current = await this.slotRepository.count({ where: { capsuleId } });
    if (current >= headcount) {
      return;
    }
    const toCreate: CapsuleParticipantSlot[] = [];
    for (let i = current; i < headcount; i++) {
      toCreate.push(
        this.slotRepository.create({
          capsuleId,
          slotIndex: i,
          userId: null,
          assignedAt: null,
        }),
      );
    }
    if (toCreate.length > 0) {
      await this.slotRepository.save(toCreate);
    }
  }

  private buildEntryMediaItems(
    entry: CapsuleEntry | null,
    mediaMap: Map<string, Media>,
  ) {
    if (!entry || !entry.mediaItemIds || entry.mediaItemIds.length === 0) {
      return [];
    }

    return entry.mediaItemIds.map((id, idx) => {
      const media = mediaMap.get(id);
      const fallbackType = entry.mediaTypes?.[idx] ?? null;
      return {
        media_id: id,
        type: media?.type ?? fallbackType ?? null,
        object_key: media?.objectKey ?? null,
      };
    });
  }

  /**
   * Entry의 미디어를 타입별로 분리하여 반환
   */
  /**
   * 캡슐 조회 로그 기록 (공통 메서드)
   * @public - 다른 서비스에서도 사용 가능
   * @param capsuleId 캡슐 ID
   * @param viewerId 조회자 ID
   */
  async logCapsuleAccess(capsuleId: string, viewerId: string): Promise<void> {
    try {
      await this.accessLogRepository.insert({ capsuleId, viewerId });
    } catch {
      // 무시: 동일 유저 중복 조회는 Unique 제약에 의해 무시됨
    }
  }

  async getCapsuleWithSlots(user: User, capsuleId: string) {
    const { capsule, product, headcount } =
      await this.ensurePaidCapsuleContext(capsuleId);

    await this.ensureSlotsCreated(capsule.id, headcount);

    const slots = await this.slotRepository.find({
      where: { capsuleId: capsule.id },
      relations: { user: true },
      order: { slotIndex: 'ASC' },
    });

    // 슬롯에서 직접 미디어 ID 수집
    const mediaIds: string[] = [];
    slots.forEach((slot) => {
      if (slot.imageIds) {
        mediaIds.push(...slot.imageIds);
      }
      if (slot.musicId) {
        mediaIds.push(slot.musicId);
      }
      if (slot.videoId) {
        mediaIds.push(slot.videoId);
      }
    });

    const mediaEntities =
      mediaIds.length > 0
        ? await this.mediaRepository.find({
            where: { id: In(Array.from(new Set(mediaIds))) },
          })
        : [];
    const mediaMap = new Map(mediaEntities.map((m) => [m.id, m] as const));

    await this.logCapsuleAccess(capsule.id, user.id);

    // 잠금 상태 계산: openAt이 현재 시간보다 미래면 잠김
    const isLocked =
      capsule.openAt !== null && capsule.openAt.getTime() > Date.now();

    // 슬롯 통계 계산
    const filledSlots = slots.filter((slot) => slot.userId !== null).length;
    const emptySlots = headcount - filledSlots;

    return {
      id: capsule.id,
      title: capsule.title,
      description: capsule.content,
      open_at: capsule.openAt,
      is_locked: isLocked,
      headcount,
      created_at: capsule.createdAt,
      product: product
        ? {
            id: product.id,
            product_type: product.productType,
            max_media_count: product.maxMediaCount,
            media_types: product.mediaTypes,
          }
        : null,
      slots: slots.map((slot) => {
        // 슬롯에서 직접 미디어 데이터 구성
        const images_ids = isLocked
          ? []
          : (slot.imageIds || []).map((id) => ({
              media_id: id,
              object_key: mediaMap.get(id)?.objectKey ?? null,
            }));

        const audio_id =
          isLocked || !slot.musicId
            ? null
            : {
                media_id: slot.musicId,
                object_key: mediaMap.get(slot.musicId)?.objectKey ?? null,
              };

        const video_id =
          isLocked || !slot.videoId
            ? null
            : {
                media_id: slot.videoId,
                object_key: mediaMap.get(slot.videoId)?.objectKey ?? null,
              };

        return {
          slot_id: slot.id,
          slot_index: slot.slotIndex,
          user_id: slot.userId,
          nickname: slot.user?.nickname ?? null,
          profile_img: slot.user?.profileImg ?? null,
          entry_id: null, // capsule_entries 테이블을 사용하지 않으므로 null
          wrote_at: slot.status === 'COMPLETED' ? slot.updatedAt : null,
          // 🔒 잠겨있으면 content와 미디어를 숨김
          content: isLocked ? null : (slot.textMessage ?? null),
          images_ids,
          audio_id,
          video_id,
        };
      }),
      stats: {
        total_slots: headcount,
        filled_slots: filledSlots,
        empty_slots: emptySlots,
      },
    };
  }

  async createCapsuleEntry(
    user: User,
    capsuleId: string,
    dto: CreateCapsuleEntryDto,
    files?: MulterFile[],
  ) {
    const trimmedContent = dto.content?.trim() ?? '';
    if (!trimmedContent) {
      throw new BadRequestException('CONTENT_REQUIRED');
    }
    if (trimmedContent.length > this.ENTRY_CONTENT_LIMIT) {
      throw new BadRequestException('CONTENT_TOO_LONG');
    }

    const { capsule, product, headcount } =
      await this.ensurePaidCapsuleContext(capsuleId);

    await this.ensureSlotsCreated(capsule.id, headcount);

    // 미디어 처리: 파일 업로드 또는 기존 media_item_ids 사용
    let mediaItemIds: string[] | null = null;
    let normalizedMediaTypes: MediaType[] | null = null;
    let mediaMap = new Map<string, Media>();

    if (files && files.length > 0) {
      // form-data로 파일이 넘어온 경우: 직접 업로드
      const uploadedMedia: Media[] = [];
      for (const file of files) {
        const type = this.mediaService.resolveMediaTypeFromMimetype(
          file.mimetype,
        );
        const media = await this.mediaService.uploadMulterFile(
          user.id,
          file,
          type,
        );
        uploadedMedia.push(media);
      }

      // 업로드된 미디어 검증
      const limit = product?.maxMediaCount ?? 3;
      if (limit > 0 && uploadedMedia.length > limit) {
        throw new BadRequestException('MEDIA_LIMIT_EXCEEDED');
      }

      if (product && product.mediaTypes && product.mediaTypes.length > 0) {
        uploadedMedia.forEach((m) => {
          if (!product.mediaTypes!.includes(m.type)) {
            throw new BadRequestException('MEDIA_TYPE_NOT_ALLOWED_FOR_PRODUCT');
          }
        });
      }

      mediaItemIds = uploadedMedia.map((m) => m.id);
      normalizedMediaTypes = uploadedMedia.map((m) => m.type);
      mediaMap = new Map(uploadedMedia.map((m) => [m.id, m] as const));
    } else if (dto.media_item_ids && dto.media_item_ids.length > 0) {
      // 기존 방식: media_item_ids 사용
      const mediaResolved = await this.resolveMediaByIds(
        user,
        dto.media_item_ids,
        product,
      );

      normalizedMediaTypes =
        mediaResolved.mediaTypes?.map((type) => {
          if (!type) {
            throw new BadRequestException('MEDIA_TYPE_REQUIRED');
          }
          return type;
        }) ?? null;

      mediaItemIds = mediaResolved.mediaItemIds;
      mediaMap = new Map(
        mediaResolved.mediaEntities.map((m) => [m.id, m] as const),
      );
    }

    const result = await this.dataSource.transaction<{
      savedEntry: CapsuleEntry;
      targetSlot: CapsuleParticipantSlot;
    }>(async (manager) => {
      const slotRepo = manager.getRepository(CapsuleParticipantSlot);
      const entryRepo = manager.getRepository(CapsuleEntry);
      const accessRepo = manager.getRepository(CapsuleAccessLog);

      const existingEntry = await entryRepo.findOne({
        where: { capsuleId: capsule.id, userId: user.id },
        lock: { mode: 'pessimistic_read' },
      });
      if (existingEntry) {
        throw new ConflictException('ENTRY_ALREADY_EXISTS');
      }

      const slots = await slotRepo.find({
        where: { capsuleId: capsule.id },
        order: { slotIndex: 'ASC' },
        lock: { mode: 'pessimistic_write' },
      });

      const targetSlot =
        slots.find((s) => s.userId === user.id) ?? slots.find((s) => !s.userId);
      if (!targetSlot) {
        throw new ConflictException('SLOTS_FULL');
      }
      if (targetSlot.userId && targetSlot.userId !== user.id) {
        throw new ForbiddenException('SLOT_OWNED_BY_ANOTHER_USER');
      }

      targetSlot.userId = user.id;
      targetSlot.assignedAt = targetSlot.assignedAt ?? new Date();

      const entry = entryRepo.create({
        capsuleId: capsule.id,
        slotId: targetSlot.id,
        userId: user.id,
        content: trimmedContent,
        mediaItemIds: mediaItemIds,
        mediaTypes: normalizedMediaTypes,
      });

      const savedEntry = await entryRepo.save(entry);
      await slotRepo.save(targetSlot);

      try {
        await accessRepo.insert({ capsuleId: capsule.id, viewerId: user.id });
      } catch {
        // 중복 조회는 무시
      }

      return { savedEntry, targetSlot };
    });

    return {
      capsule_id: capsule.id,
      entry_id: result.savedEntry.id,
      slot_id: result.targetSlot.id,
      slot_index: result.targetSlot.slotIndex,
      wrote_at: result.savedEntry.createdAt,
      content: result.savedEntry.content,
      media_items: this.buildEntryMediaItems(result.savedEntry, mediaMap),
    };
  }

  /**
   * 사용자의 남은 캡슐 슬롯 개수 조회
   * @param userId 사용자 ID
   * @returns 전체 슬롯 수, 사용 중인 슬롯 수, 남은 슬롯 수
   */
  async getCapsuleSlots(userId: string): Promise<GetCapsuleSlotsResponseDto> {
    // 1. 사용자 조회
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // 2. 전체 슬롯 수는 항상 DEFAULT_EGG_SLOTS (3)으로 고정
    const totalSlots = this.DEFAULT_EGG_SLOTS;

    // 3. 실제 캡슐 개수 조회 (삭제되지 않은 캡슐 개수)
    const actualCapsuleCount = await this.capsuleRepository.count({
      where: {
        userId,
        deletedAt: IsNull(),
      },
    });

    // 4. usedSlots는 totalSlots를 초과할 수 없음
    const usedSlots = Math.min(actualCapsuleCount, totalSlots);

    // 5. remainingSlots는 음수가 될 수 없음
    const remainingSlots = Math.max(0, totalSlots - actualCapsuleCount);

    return {
      totalSlots,
      usedSlots,
      remainingSlots,
    };
  }

  // ==========================================
  // 이스터에그 발견 기록 관련 메서드
  // ==========================================

  /**
   * 이스터에그 발견 기록
   * 중복 호출을 방지하기 위해 먼저 기존 로그를 확인한 후 처리
   */
  async recordCapsuleViewer(
    user: User,
    capsuleId: string,
  ): Promise<{ success: boolean; message: string; is_first_view: boolean }> {
    // 트랜잭션으로 감싸서 access_log 삽입과 view_count 증가를 원자적으로 처리
    const result = await this.dataSource.transaction(async (manager) => {
      const capsuleRepo = manager.getRepository(Capsule);
      const accessLogRepo = manager.getRepository(CapsuleAccessLog);

      // 1. 캡슐 존재 확인 및 잠금
      const capsule = await capsuleRepo.findOne({
        where: { id: capsuleId },
        lock: { mode: 'pessimistic_write' }, // 동시성 제어를 위한 잠금
      });

      if (!capsule || capsule.deletedAt) {
        throw new NotFoundException('CAPSULE_NOT_FOUND');
      }

      // 본인 캡슐인 경우 로그 기록하지 않고, view_count도 증가시키지 않음
      if (capsule.userId === user.id) {
        return {
          success: true,
          message: '본인이 작성한 이스터에그입니다.',
          is_first_view: false,
          capsule,
        };
      }

      // 2. 기존 조회 로그 확인 (중복 방지)
      const existingLog = await accessLogRepo.findOne({
        where: {
          capsuleId,
          viewerId: user.id,
        },
      });

      // 3. 이미 조회한 적이 있으면 중복으로 처리
      if (existingLog) {
        return {
          success: true,
          message: '이미 발견한 이스터에그입니다.',
          is_first_view: false,
          capsule,
        };
      }

      // 4. 첫 조회인 경우 access_log 삽입 및 view_count 증가
      await accessLogRepo.insert({
        capsuleId,
        viewerId: user.id,
      });

      // 5. view_count 증가 (같은 트랜잭션 내에서 원자적으로 처리)
      capsule.viewCount += 1;
      await capsuleRepo.save(capsule);

      return {
        success: true,
        message: '이스터에그를 발견했습니다!',
        is_first_view: true,
        capsule,
      };
    });

    // 6. 트랜잭션 외부에서 알림 전송 (첫 조회인 경우)
    if (result.is_first_view && result.capsule) {
      // 비동기 알림 전송 (실패해도 에러 처리하지 않음)
      this.pushNotificationService
        .createAndSendNotification(
          result.capsule.userId,
          NotificationType.EASTER_EGG_VIEWED,
          '누군가 내 이스터에그를 발견했어요!',
          `${user.nickname}님이 내 이스터에그를 발견했습니다.`,
          {
            eggId: capsuleId,
            viewerId: user.id,
          },
        )
        .catch((error) => {
          console.error('이스터에그 발견 알림 전송 실패:', error);
        });
    }

    // capsule 정보를 제외하고 반환
    return {
      success: result.success,
      message: result.message,
      is_first_view: result.is_first_view,
    };
  }

  /**
   * 이스터에그 발견자 목록 조회
   * 기존 findOne() 메서드의 viewers 조회 로직을 재사용
   */
  async getCapsuleViewers(
    user: User,
    capsuleId: string,
  ): Promise<GetViewersResponseDto> {
    // 1. 캡슐 존재 확인
    const capsule = await this.capsuleRepository.findOne({
      where: { id: capsuleId },
    });

    if (!capsule || capsule.deletedAt) {
      throw new NotFoundException('CAPSULE_NOT_FOUND');
    }

    // 2. 조회자 목록 조회 (작성자 본인 제외)
    const accessLogs = await this.accessLogRepository.find({
      where: { capsuleId: capsule.id },
      relations: { viewer: true },
      order: { viewedAt: 'ASC' },
    });

    // 작성자 본인은 제외
    const viewers = accessLogs
      .filter((log) => log.viewerId !== capsule.userId)
      .map((log) => ({
        id: log.viewer.id,
        nickname: log.viewer.nickname,
        profile_img: log.viewer.profileImg,
        viewed_at: log.viewedAt,
      }));

    return {
      capsule_id: capsule.id,
      total_viewers: viewers.length,
      view_limit: capsule.viewLimit,
      viewers,
    };
  }

  // ==========================================
  // 이스터에그 목록 조회 (내가 심은 알 / 발견한 알)
  // ==========================================

  /**
   * 내가 심은 알 / 발견한 알 목록 조회
   */
  async getMyEggs(user: User, type: string, sort?: string) {
    if (type === 'PLANTED') {
      return this.getMyPlantedEggs(user);
    } else if (type === 'FOUND') {
      return this.getMyFoundEggs(user, sort);
    }
    throw new BadRequestException('INVALID_TYPE');
  }

  /**
   * 내가 심은 알 목록 조회
   */
  private async getMyPlantedEggs(user: User) {
    // 사용자가 작성한 이스터에그만 조회 (soft delete 포함)
    const capsules = await this.capsuleRepository
      .createQueryBuilder('capsule')
      .leftJoinAndSelect('capsule.product', 'product')
      .where('capsule.user_id = :userId', { userId: user.id })
      .andWhere(
        '(product.product_type = :productType OR capsule.product_id IS NULL)',
        {
          productType: 'EASTER_EGG',
        },
      )
      .withDeleted() // soft delete된 것도 포함
      .orderBy('capsule.created_at', 'DESC')
      .getMany();

    // 미디어 정보 조회
    const allMediaIds = capsules
      .filter((c) => c.mediaItemIds && c.mediaItemIds.length > 0)
      .flatMap((c) => c.mediaItemIds!);

    const uniqueMediaIds = Array.from(new Set(allMediaIds));
    const mediaEntities =
      uniqueMediaIds.length > 0
        ? await this.mediaRepository.find({
            where: { id: In(uniqueMediaIds) },
          })
        : [];

    const mediaMap = new Map(mediaEntities.map((m) => [m.id, m]));

    // 캡슐을 active와 expired로 분리
    const activeEggs: any[] = [];
    const expiredEggs: any[] = [];

    for (const capsule of capsules) {
      const mediaTypes = this.getMediaTypesFromCapsule(capsule, mediaMap);

      const eggItem = {
        eggId: capsule.id,
        title: capsule.title,
        content: capsule.content,
        viewCount: capsule.viewCount,
        latitude: capsule.latitude ? Number(capsule.latitude) : null,
        longitude: capsule.longitude ? Number(capsule.longitude) : null,
        hasImage: mediaTypes.includes(MediaType.IMAGE),
        hasAudio: mediaTypes.includes(MediaType.AUDIO),
        hasVideo: mediaTypes.includes(MediaType.VIDEO),
        createdDate: capsule.createdAt,
        status: capsule.deletedAt ? 'EXPIRED' : 'ACTIVE',
      };

      if (capsule.deletedAt) {
        expiredEggs.push(eggItem);
      } else {
        activeEggs.push(eggItem);
      }
    }

    return {
      summary: {
        totalPlantedCount: capsules.length,
        activeCount: activeEggs.length,
      },
      data: {
        activeEggs,
        expiredEggs,
      },
    };
  }

  /**
   * 내가 발견한 알 목록 조회
   */
  private async getMyFoundEggs(user: User, sort?: string) {
    // 사용자가 발견한 이스터에그만 조회 (access log 기준)
    const accessLogs = await this.accessLogRepository
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.capsule', 'capsule')
      .leftJoinAndSelect('capsule.product', 'product')
      .where('log.viewer_id = :viewerId', { viewerId: user.id })
      .andWhere('capsule.deleted_at IS NULL') // 소멸된 캡슐은 제외
      .andWhere(
        '(product.product_type = :productType OR capsule.product_id IS NULL)',
        {
          productType: 'EASTER_EGG',
        },
      )
      .orderBy(
        'log.viewed_at',
        sort === 'OLDEST' ? 'ASC' : 'DESC', // 기본값은 LATEST (DESC)
      )
      .getMany();

    // 미디어 정보 조회
    const allMediaIds = accessLogs.flatMap((log) => {
      if (log.capsule?.mediaItemIds && log.capsule.mediaItemIds.length > 0) {
        return log.capsule.mediaItemIds;
      }
      return [];
    });

    const uniqueMediaIds = Array.from(new Set(allMediaIds));
    const mediaEntities =
      uniqueMediaIds.length > 0
        ? await this.mediaRepository.find({
            where: { id: In(uniqueMediaIds) },
          })
        : [];

    const mediaMap = new Map(mediaEntities.map((m) => [m.id, m]));

    const data = accessLogs
      .filter(
        (
          log,
        ): log is typeof log & { capsule: NonNullable<typeof log.capsule> } =>
          !!log.capsule,
      )
      .map((log) => {
        const capsule = log.capsule;
        const mediaTypes = this.getMediaTypesFromCapsule(capsule, mediaMap);

        return {
          eggId: capsule.id,
          title: capsule.title,
          content: capsule.content,
          viewCount: capsule.viewCount,
          latitude: capsule.latitude ? Number(capsule.latitude) : null,
          longitude: capsule.longitude ? Number(capsule.longitude) : null,
          hasImage: mediaTypes.includes(MediaType.IMAGE),
          hasAudio: mediaTypes.includes(MediaType.AUDIO),
          hasVideo: mediaTypes.includes(MediaType.VIDEO),
          foundDate: log.viewedAt, // 발견한 날짜
          createdDate: capsule.createdAt, // 심어진 날짜
        };
      });

    return {
      summary: {
        totalFoundCount: data.length,
      },
      data,
    };
  }

  /**
   * 캡슐의 미디어 타입 목록 조회 (헬퍼 메서드)
   */
  private getMediaTypesFromCapsule(
    capsule: Capsule,
    mediaMap: Map<string, Media>,
  ): MediaType[] {
    if (!capsule.mediaItemIds || capsule.mediaItemIds.length === 0) {
      return [];
    }

    return capsule.mediaItemIds
      .map((id, idx) => {
        const media = mediaMap.get(id);
        if (media) {
          return media.type;
        }
        // fallback: capsule.mediaTypes 사용
        if (capsule.mediaTypes && idx < capsule.mediaTypes.length) {
          return capsule.mediaTypes[idx];
        }
        return null;
      })
      .filter((type): type is MediaType => type !== null);
  }

  /**
   * 타임캡슐 조회 (토큰 없이 참여자 확인)
   * @param capsuleId 캡슐 ID
   * @param userId 사용자 ID
   * @returns 타임캡슐 상세 정보 (모든 참여자 데이터 포함)
   */
  async getTimecapsuleForParticipant(capsuleId: string, userId: string) {
    // 1. 캡슐 조회
    const { capsule, product, headcount } =
      await this.ensurePaidCapsuleContext(capsuleId);

    // 2. 슬롯 생성 확인
    await this.ensureSlotsCreated(capsule.id, headcount);

    // 3. 참여자 확인
    const participantSlot = await this.slotRepository.findOne({
      where: { capsuleId: capsule.id, userId },
    });

    if (!participantSlot) {
      throw new ForbiddenException('NOT_PARTICIPANT');
    }

    // 4. 모든 슬롯 조회 (참여자이므로 모든 데이터 접근 가능)
    const slots = await this.slotRepository.find({
      where: { capsuleId: capsule.id },
      relations: { user: true },
      order: { slotIndex: 'ASC' },
    });

    // 5. 슬롯에서 미디어 ID 수집
    const mediaIds: string[] = [];
    slots.forEach((slot) => {
      if (slot.imageIds) {
        mediaIds.push(...slot.imageIds);
      }
      if (slot.musicId) {
        mediaIds.push(slot.musicId);
      }
      if (slot.videoId) {
        mediaIds.push(slot.videoId);
      }
    });

    const mediaEntities =
      mediaIds.length > 0
        ? await this.mediaRepository.find({
            where: { id: In(Array.from(new Set(mediaIds))) },
          })
        : [];
    const mediaMap = new Map(mediaEntities.map((m) => [m.id, m] as const));

    // 6. 조회 로그 기록
    await this.logCapsuleAccess(capsule.id, userId);

    // 7. 잠금 상태 계산
    const isLocked =
      capsule.openAt !== null && capsule.openAt.getTime() > Date.now();

    // 8. 슬롯 통계 계산
    const filledSlots = slots.filter((slot) => slot.userId !== null).length;
    const emptySlots = headcount - filledSlots;

    return {
      id: capsule.id,
      title: capsule.title,
      description: capsule.content,
      open_at: capsule.openAt,
      is_locked: isLocked,
      headcount,
      created_at: capsule.createdAt,
      product: product
        ? {
            id: product.id,
            product_type: product.productType,
            max_media_count: product.maxMediaCount,
            media_types: product.mediaTypes,
          }
        : null,
      slots: slots.map((slot) => {
        // 🔒 잠겨있으면 content와 미디어를 숨김
        const images_ids = isLocked
          ? []
          : (slot.imageIds || []).map((id) => ({
              media_id: id,
              object_key: mediaMap.get(id)?.objectKey ?? null,
            }));

        const audio_id =
          isLocked || !slot.musicId
            ? null
            : {
                media_id: slot.musicId,
                object_key: mediaMap.get(slot.musicId)?.objectKey ?? null,
              };

        const video_id =
          isLocked || !slot.videoId
            ? null
            : {
                media_id: slot.videoId,
                object_key: mediaMap.get(slot.videoId)?.objectKey ?? null,
              };

        return {
          slot_id: slot.id,
          slot_index: slot.slotIndex,
          user_id: slot.userId,
          nickname: slot.user?.nickname ?? null,
          profile_img: slot.user?.profileImg ?? null,
          entry_id: null,
          wrote_at: slot.status === 'COMPLETED' ? slot.updatedAt : null,
          content: isLocked ? null : (slot.textMessage ?? null),
          images_ids,
          audio_id,
          video_id,
        };
      }),
      stats: {
        total_slots: headcount,
        filled_slots: filledSlots,
        empty_slots: emptySlots,
      },
    };
  }
}
