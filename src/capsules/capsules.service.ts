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
import { Friendship } from '../entities/friendship.entity';
import { CapsuleType, FriendStatus } from '../common/enums';
import { GetCapsuleQueryDto } from './dto/get-capsule.dto';
import { GetCapsulesListQueryDto } from './dto/get-capsules-list.dto';
import {
  CapsuleAccessLog,
  CapsuleEntry,
  CapsuleParticipantSlot,
  Media,
} from '../entities';
import { GetCapsuleSlotsResponseDto } from './dto/get-capsule-slots.dto';
import { CapsuleMediaService } from './capsule-media.service';
import { CapsuleAccessService } from './capsule-access.service';

@Injectable()
export class CapsulesService {
  private readonly DEFAULT_EGG_SLOTS = 3;

  constructor(
    @InjectRepository(Capsule)
    private readonly capsuleRepository: Repository<Capsule>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Friendship)
    private readonly friendshipRepository: Repository<Friendship>,
    @InjectRepository(Media)
    private readonly mediaRepository: Repository<Media>,
    @InjectRepository(CapsuleParticipantSlot)
    private readonly slotRepository: Repository<CapsuleParticipantSlot>,
    @InjectRepository(CapsuleAccessLog)
    private readonly accessLogRepository: Repository<CapsuleAccessLog>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly capsuleMediaService: CapsuleMediaService,
    private readonly capsuleAccessService: CapsuleAccessService,
  ) {}

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

  async findOne(user: User, id: string, query: GetCapsuleQueryDto) {
    const capsule = await this.capsuleRepository.findOne({
      where: { id },
      relations: {
        user: true,
        easterEgg: true,
        timeCapsule: { order: { product: true } },
      },
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

    const openAt = capsule.timeCapsule?.openAt ?? null;
    const isLocked = openAt !== null && openAt.getTime() > Date.now();

    const mediaEntities =
      capsule.mediaItemIds && capsule.mediaItemIds.length > 0
        ? await this.mediaRepository.find({
            where: { id: In(capsule.mediaItemIds) },
          })
        : [];
    const mediaItems = this.capsuleMediaService.buildMediaItems(
      capsule,
      mediaEntities,
    );

    // 조회 로그 기록 (본인 캡슐이 아닌 경우만)
    if (capsule.userId !== user.id) {
      await this.capsuleAccessService.logCapsuleAccess(capsule.id, user.id);
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

    const product = capsule.timeCapsule?.order?.product ?? null;
    const viewLimit =
      capsule.capsuleType === CapsuleType.TIME_CAPSULE
        ? (capsule.timeCapsule?.order?.headcount ?? 0)
        : (capsule.easterEgg?.viewLimit ?? 0);
    const viewCount = capsule.easterEgg?.viewCount ?? 0;

    return {
      id: capsule.id,
      title: capsule.title,
      content: isLocked ? null : capsule.content,
      open_at: openAt,
      is_locked: isLocked,
      view_limit: viewLimit,
      view_count: viewCount,
      media_items: mediaItems,
      product,
      latitude: capsule.latitude,
      longitude: capsule.longitude,
      text_blocks: isLocked ? null : capsule.textBlocks,
      author,
      viewers,
      created_at: capsule.createdAt,
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
      .leftJoinAndSelect('capsule.easterEgg', 'egg')
      .leftJoinAndSelect('capsule.timeCapsule', 'timeCapsule')
      .leftJoinAndSelect('timeCapsule.order', 'order')
      .leftJoinAndSelect('order.product', 'timeProduct')
      .where('capsule.deleted_at IS NULL')
      .andWhere('(timeProduct.id IS NULL OR timeProduct.isActive = true)')
      .andWhere(
        `(
          -- 이스터에그: 본인 것 또는 친구 것
          (
            capsule.capsule_type = :easterEggType
            AND (
              capsule.user_id = :userId
              OR EXISTS (SELECT 1 FROM friendships f WHERE f.user_id = :userId AND f.friend_id = capsule.user_id AND f.status = :status)
              OR EXISTS (SELECT 1 FROM friendships fr WHERE fr.user_id = capsule.user_id AND fr.friend_id = :userId AND fr.status = :status)
            )
          )
          -- 타임캡슐: 본인 것 또는 본인이 참여 중인 것
          OR (
            capsule.capsule_type = :timeCapsuleType
            AND (
              capsule.user_id = :userId
              OR EXISTS (SELECT 1 FROM capsule_participant_slots s WHERE s.capsule_id = capsule.id AND s.user_id = :userId)
            )
          )
        )`,
        {
          userId: user.id,
          status: FriendStatus.CONNECTED,
          easterEggType: CapsuleType.EASTER_EGG,
          timeCapsuleType: CapsuleType.TIME_CAPSULE,
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
        '(capsule.capsule_type <> :eggType OR egg.view_limit = 0 OR egg.view_count < egg.view_limit)',
        { eggType: CapsuleType.EASTER_EGG },
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
      const egg = capsule.easterEgg;
      const timeCapsule = capsule.timeCapsule;
      const openAt = timeCapsule?.openAt ?? null;
      const isLocked = openAt !== null && openAt.getTime() > Date.now();
      const viewLimit =
        capsule.capsuleType === CapsuleType.TIME_CAPSULE
          ? (timeCapsule?.order?.headcount ?? 0)
          : (egg?.viewLimit ?? 0);
      const viewCount = egg?.viewCount ?? 0;
      const canOpen =
        capsule.capsuleType === CapsuleType.EASTER_EGG
          ? viewLimit === 0 || viewCount < viewLimit
          : true;
      const mediaItems = this.capsuleMediaService.buildMediaItems(capsule);

      const capsuleType = capsule.capsuleType;
      // 본인 캡슐 여부 확인
      const isMine = capsule.userId === user.id;

      const product = timeCapsule?.order?.product ?? null;

      return {
        id: capsule.id,
        title: capsule.title,
        content: isLocked ? null : capsule.content,
        open_at: openAt,
        is_locked: isLocked,
        view_limit: viewLimit,
        view_count: viewCount,
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
        product: product
          ? {
              id: product.id,
              product_type: product.productType,
              max_media_count: product.maxMediaCount,
              media_types: product.mediaTypes,
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

  /**
   * Entry의 미디어를 타입별로 분리하여 반환
   */
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
}
