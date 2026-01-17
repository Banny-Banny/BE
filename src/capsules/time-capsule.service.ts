import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import {
  Capsule,
  CapsuleEntry,
  CapsuleParticipantSlot,
  Media,
  Order,
  TimeCapsule,
  User,
} from '../entities';
import { ProductType } from '../entities/product.entity';
import {
  CapsuleType,
  MediaType,
  OrderStatus,
  TimeOption,
} from '../common/enums';
import { CreateCapsuleEntryDto } from './dto/create-capsule-entry.dto';
import { CapsuleMediaService } from './capsule-media.service';
import { CapsuleAccessService } from './capsule-access.service';
import { MediaService } from '../media/media.service';
import { MulterFile } from '../media/types/multer-file.interface';

@Injectable()
export class TimeCapsuleService {
  private readonly DEFAULT_MEDIA_LIMIT = 3;
  private readonly ENTRY_CONTENT_LIMIT = 2000;

  constructor(
    @InjectRepository(Capsule)
    private readonly capsuleRepository: Repository<Capsule>,
    @InjectRepository(TimeCapsule)
    private readonly timeCapsuleRepository: Repository<TimeCapsule>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(CapsuleParticipantSlot)
    private readonly slotRepository: Repository<CapsuleParticipantSlot>,
    @InjectRepository(CapsuleEntry)
    private readonly entryRepository: Repository<CapsuleEntry>,
    @InjectRepository(Media)
    private readonly mediaRepository: Repository<Media>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly capsuleMediaService: CapsuleMediaService,
    private readonly capsuleAccessService: CapsuleAccessService,
    private readonly mediaService: MediaService,
  ) {}

  async createFromPaidOrder(orderId: string): Promise<Capsule> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: { product: true, timeCapsule: { capsule: true } },
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

    if (order.timeCapsule?.capsule) {
      return order.timeCapsule.capsule;
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
      const capsuleRepo = manager.getRepository(Capsule);
      const timeCapsuleRepo = manager.getRepository(TimeCapsule);
      const existing = await timeCapsuleRepo.findOne({
        where: { orderId: order.id },
        relations: { capsule: true },
      });
      if (existing?.capsule) {
        existing.capsule.timeCapsule = existing;
        return existing.capsule;
      }

      const capsule = capsuleRepo.create({
        userId: order.userId,
        capsuleType: CapsuleType.TIME_CAPSULE,
        latitude: null,
        longitude: null,
        title: 'My Time Capsule',
        content: null,
        mediaUrls: null,
        mediaItemIds: null,
        mediaTypes: null,
        textBlocks: null,
      });
      const saved = await capsuleRepo.save(capsule);

      const timeCapsule = timeCapsuleRepo.create({
        capsuleId: saved.id,
        orderId: order.id,
        openAt,
        isLocked: true,
        inviteCode: null,
        deadline: null,
        roomStatus: null,
        buriedAt: null,
        isAutoSubmitted: false,
      });
      timeCapsule.order = order;
      await timeCapsuleRepo.save(timeCapsule);
      saved.timeCapsule = timeCapsule;
      return saved;
    });
  }

  async ensurePaidCapsuleContext(capsuleId: string) {
    const capsule = await this.capsuleRepository.findOne({
      where: { id: capsuleId },
      relations: {
        timeCapsule: { order: { product: true } },
      },
    });

    if (!capsule || capsule.deletedAt) {
      throw new NotFoundException('CAPSULE_NOT_FOUND');
    }

    if (
      capsule.capsuleType !== CapsuleType.TIME_CAPSULE ||
      !capsule.timeCapsule?.order ||
      capsule.timeCapsule.order.status !== OrderStatus.PAID
    ) {
      throw new ForbiddenException('CAPSULE_PAYMENT_REQUIRED');
    }

    if (capsule.timeCapsule.order.headcount < 1) {
      throw new BadRequestException('HEADCOUNT_INVALID');
    }

    return {
      capsule,
      order: capsule.timeCapsule.order,
      product: capsule.timeCapsule.order.product ?? null,
      headcount: capsule.timeCapsule.order.headcount,
    };
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

    await this.capsuleAccessService.logCapsuleAccess(capsule.id, user.id);

    const openAt = capsule.timeCapsule?.openAt ?? null;
    const isLocked = openAt !== null && openAt.getTime() > Date.now();

    const filledSlots = slots.filter((slot) => slot.userId !== null).length;
    const emptySlots = headcount - filledSlots;

    return {
      id: capsule.id,
      title: capsule.title,
      description: capsule.content,
      open_at: openAt,
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
          is_owner: slot.slotIndex === 0,
          is_filled: !!slot.userId,
          status: slot.status,
          text_message: isLocked ? null : slot.textMessage,
          images_ids,
          audio_id,
          video_id,
        };
      }),
      meta: {
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

    let mediaItemIds: string[] | null = null;
    let resolvedMediaTypes: MediaType[] | null = null;

    if (files && files.length > 0) {
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
    } else if (dto.media_item_ids && dto.media_item_ids.length > 0) {
      const mediaResolved = await this.capsuleMediaService.resolveMediaByIds(
        user,
        dto.media_item_ids,
        product,
      );
      mediaItemIds = mediaResolved.mediaItemIds;
      resolvedMediaTypes = mediaResolved.mediaTypes ?? null;
    }

    return await this.dataSource.transaction(async (manager) => {
      const slotRepo = manager.getRepository(CapsuleParticipantSlot);
      const entryRepo = manager.getRepository(CapsuleEntry);

      const slots = await slotRepo.find({
        where: { capsuleId: capsule.id },
        order: { slotIndex: 'ASC' },
      });

      const targetSlot = slots.find((s) => s.userId === user.id);
      if (!targetSlot) {
        throw new ForbiddenException('NOT_PARTICIPANT');
      }

      const existingEntry = await entryRepo.findOne({
        where: { capsuleId: capsule.id, userId: user.id },
      });
      if (existingEntry) {
        throw new ConflictException('ALREADY_SUBMITTED');
      }

      targetSlot.status = 'COMPLETED';
      targetSlot.nickname = targetSlot.nickname ?? user.nickname;
      targetSlot.textMessage = trimmedContent;
      targetSlot.assignedAt = targetSlot.assignedAt ?? new Date();
      await slotRepo.save(targetSlot);

      const entry = entryRepo.create({
        capsuleId: capsule.id,
        slotId: targetSlot.id,
        userId: user.id,
        content: trimmedContent,
        mediaItemIds,
        mediaTypes: resolvedMediaTypes,
      } as Partial<CapsuleEntry>);
      const savedEntry = await entryRepo.save(entry);
      if (Array.isArray(savedEntry)) {
        throw new ConflictException('ENTRY_SAVE_FAILED');
      }

      const mediaEntities =
        mediaItemIds && mediaItemIds.length > 0
          ? await this.mediaRepository.find({
              where: { id: In(mediaItemIds) },
            })
          : [];
      const mediaMap = new Map(mediaEntities.map((m) => [m.id, m]));

      return {
        slot_id: targetSlot.id,
        slot_index: targetSlot.slotIndex,
        wrote_at: savedEntry.createdAt,
        content: savedEntry.content,
        media_items: this.capsuleMediaService.buildEntryMediaItems(
          savedEntry,
          mediaMap,
        ),
      };
    });
  }

  async getTimecapsuleForParticipant(capsuleId: string, userId: string) {
    const { capsule, product, headcount } =
      await this.ensurePaidCapsuleContext(capsuleId);

    await this.ensureSlotsCreated(capsule.id, headcount);

    const participantSlot = await this.slotRepository.findOne({
      where: { capsuleId: capsule.id, userId },
    });

    if (!participantSlot) {
      throw new ForbiddenException('NOT_PARTICIPANT');
    }

    const slots = await this.slotRepository.find({
      where: { capsuleId: capsule.id },
      relations: { user: true },
      order: { slotIndex: 'ASC' },
    });

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

    const openAt = capsule.timeCapsule?.openAt ?? null;
    const isLocked = openAt !== null && openAt.getTime() > Date.now();

    return {
      id: capsule.id,
      title: capsule.title,
      description: capsule.content,
      open_at: openAt,
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
          is_owner: slot.slotIndex === 0,
          is_filled: !!slot.userId,
          status: slot.status,
          text_message: isLocked ? null : slot.textMessage,
          images_ids,
          audio_id,
          video_id,
        };
      }),
    };
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

  private computeOpenAtFromTimeOption(
    timeOption: TimeOption,
    customOpenAt?: Date | null,
  ) {
    const now = new Date();
    switch (timeOption) {
      case TimeOption.ONE_WEEK:
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      case TimeOption.ONE_MONTH:
        return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      case TimeOption.ONE_YEAR:
        return new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
      case TimeOption.TWO_YEAR:
        return new Date(now.getTime() + 2 * 365 * 24 * 60 * 60 * 1000);
      case TimeOption.THREE_YEAR:
        return new Date(now.getTime() + 3 * 365 * 24 * 60 * 60 * 1000);
      case TimeOption.CUSTOM:
        return customOpenAt || now;
      default:
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    }
  }
}
