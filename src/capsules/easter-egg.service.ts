import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Capsule, CapsuleAccessLog, EasterEgg, Media, User } from '../entities';
import { Product, ProductType } from '../entities/product.entity';
import { CapsuleType, MediaType } from '../common/enums';
import { CreateCapsuleDto } from './dto/create-capsule.dto';
import { MulterFile } from '../media/types/multer-file.interface';
import { MediaService } from '../media/media.service';
import { CapsuleMediaService } from './capsule-media.service';
import { CapsuleAccessService } from './capsule-access.service';
import { GetViewersResponseDto } from './dto/get-viewers-response.dto';

@Injectable()
export class EasterEggService {
  private readonly DEFAULT_MEDIA_LIMIT = 3;
  private readonly TEXT_BLOCK_MAX_COUNT = 5;
  private readonly TEXT_BLOCK_TOTAL_LIMIT = 2000;

  constructor(
    @InjectRepository(Capsule)
    private readonly capsuleRepository: Repository<Capsule>,
    @InjectRepository(EasterEgg)
    private readonly easterEggRepository: Repository<EasterEgg>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Media)
    private readonly mediaRepository: Repository<Media>,
    @InjectRepository(CapsuleAccessLog)
    private readonly accessLogRepository: Repository<CapsuleAccessLog>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly mediaService: MediaService,
    private readonly capsuleMediaService: CapsuleMediaService,
    private readonly capsuleAccessService: CapsuleAccessService,
  ) {}

  async create(user: User, dto: CreateCapsuleDto, files?: MulterFile[]) {
    if (!user) {
      throw new ConflictException('USER_NOT_FOUND');
    }

    if (user.eggSlots <= 0) {
      throw new ConflictException('EGG_SLOTS_EXCEEDED');
    }

    if (dto.open_at) {
      throw new BadRequestException('OPEN_AT_NOT_ALLOWED_FOR_EASTER_EGG');
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

    if (product && product.productType !== ProductType.EASTER_EGG) {
      throw new BadRequestException('PRODUCT_NOT_EASTER_EGG');
    }

    if (dto.latitude === undefined || dto.latitude === null) {
      throw new BadRequestException('LATITUDE_REQUIRED_FOR_EASTER_EGG');
    }
    if (dto.longitude === undefined || dto.longitude === null) {
      throw new BadRequestException('LONGITUDE_REQUIRED_FOR_EASTER_EGG');
    }

    const textBlocks = this.validateTextBlocks(dto.text_blocks);

    // 미디어 처리: 파일 업로드 또는 기존 media_ids 사용
    let mediaItemIds: string[] | null = null;
    let resolvedMediaTypes: (MediaType | null)[] | null = null;

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
    } else if (dto.media_ids && dto.media_ids.length > 0) {
      const resolved = await this.capsuleMediaService.resolveMediaByIds(
        user,
        dto.media_ids,
        product,
      );
      mediaItemIds = resolved.mediaItemIds;
      resolvedMediaTypes = resolved.mediaTypes;
    }

    const capsule = new Capsule();
    capsule.userId = user.id;
    capsule.capsuleType = CapsuleType.EASTER_EGG;
    capsule.latitude = dto.latitude ?? null;
    capsule.longitude = dto.longitude ?? null;
    capsule.title = dto.title;
    capsule.content = dto.content ?? null;
    capsule.mediaUrls = null;
    capsule.mediaItemIds = mediaItemIds;
    capsule.mediaTypes = resolvedMediaTypes;
    capsule.textBlocks = textBlocks;

    return this.dataSource.transaction<Capsule>(async (manager) => {
      const userRepo = manager.getRepository(User);
      const eggRepo = manager.getRepository(EasterEgg);
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

      const saved = await manager.getRepository(Capsule).save(capsule);
      const egg = eggRepo.create({
        capsuleId: saved.id,
        viewLimit,
        viewCount: 0,
      });
      await eggRepo.save(egg);
      saved.easterEgg = egg;

      return {
        ...saved,
        mediaItems: this.capsuleMediaService.buildMediaItems(saved),
      } as Capsule;
    });
  }

  async getEggDetail(user: User, eggId: string) {
    const capsule = await this.capsuleRepository.findOne({
      where: { id: eggId },
      relations: { easterEgg: true, user: true },
      withDeleted: true,
    });

    if (!capsule || capsule.capsuleType !== CapsuleType.EASTER_EGG) {
      throw new NotFoundException('CAPSULE_NOT_FOUND');
    }

    const isMine = capsule.userId === user.id;
    if (!isMine && capsule.deletedAt) {
      throw new NotFoundException('CAPSULE_NOT_FOUND');
    }

    const mediaEntities =
      capsule.mediaItemIds && capsule.mediaItemIds.length > 0
        ? await this.mediaRepository.find({
            where: { id: In(capsule.mediaItemIds) },
          })
        : [];

    const mediaMap = new Map(mediaEntities.map((m) => [m.id, m]));
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

    if (!isMine) {
      await this.capsuleAccessService.logCapsuleAccess(capsule.id, user.id);
    }

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

    const author = {
      id: capsule.user.id,
      nickname: capsule.user.nickname,
      profileImg: capsule.user.profileImg,
    };

    let type: 'FOUND' | 'PLANTED' = 'PLANTED';
    let foundAt: Date | null = null;

    if (!isMine) {
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

  async recordCapsuleViewer(
    user: User,
    capsuleId: string,
  ): Promise<{ success: boolean; message: string; is_first_view: boolean }> {
    const result = await this.dataSource.transaction(async (manager) => {
      const capsuleRepo = manager.getRepository(Capsule);
      const eggRepo = manager.getRepository(EasterEgg);
      const accessLogRepo = manager.getRepository(CapsuleAccessLog);

      const capsule = await capsuleRepo.findOne({
        where: { id: capsuleId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!capsule || capsule.deletedAt) {
        throw new NotFoundException('CAPSULE_NOT_FOUND');
      }
      if (capsule.capsuleType !== CapsuleType.EASTER_EGG) {
        throw new NotFoundException('CAPSULE_NOT_FOUND');
      }

      if (capsule.userId === user.id) {
        return {
          success: true,
          message: '본인이 작성한 이스터에그입니다.',
          is_first_view: false,
          capsule,
        };
      }

      const existingLog = await accessLogRepo.findOne({
        where: {
          capsuleId,
          viewerId: user.id,
        },
      });

      if (existingLog) {
        return {
          success: true,
          message: '이미 발견한 이스터에그입니다.',
          is_first_view: false,
          capsule,
        };
      }

      await accessLogRepo.insert({
        capsuleId,
        viewerId: user.id,
      });

      const egg = await eggRepo.findOne({
        where: { capsuleId },
        lock: { mode: 'pessimistic_write' },
      });
      if (egg) {
        egg.viewCount = (egg.viewCount ?? 0) + 1;
        await eggRepo.save(egg);
      }

      return {
        success: true,
        message: '이스터에그를 발견했습니다!',
        is_first_view: true,
        capsule,
      };
    });

    return {
      success: result.success,
      message: result.message,
      is_first_view: result.is_first_view,
    };
  }

  async getCapsuleViewers(
    user: User,
    capsuleId: string,
  ): Promise<GetViewersResponseDto> {
    const capsule = await this.capsuleRepository.findOne({
      where: { id: capsuleId },
      relations: { easterEgg: true },
    });

    if (!capsule || capsule.deletedAt) {
      throw new NotFoundException('CAPSULE_NOT_FOUND');
    }
    if (capsule.capsuleType !== CapsuleType.EASTER_EGG) {
      throw new NotFoundException('CAPSULE_NOT_FOUND');
    }

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

    return {
      capsule_id: capsule.id,
      total_viewers: viewers.length,
      view_limit: capsule.easterEgg?.viewLimit ?? 0,
      viewers,
    };
  }

  async getMyEggs(user: User, type: string, sort?: string) {
    if (type === 'PLANTED') {
      return this.getMyPlantedEggs(user);
    }
    if (type === 'FOUND') {
      return this.getMyFoundEggs(user, sort);
    }
    throw new BadRequestException('INVALID_TYPE');
  }

  private async getMyPlantedEggs(user: User) {
    const capsules = await this.capsuleRepository
      .createQueryBuilder('capsule')
      .leftJoinAndSelect('capsule.easterEgg', 'egg')
      .where('capsule.user_id = :userId', { userId: user.id })
      .andWhere('capsule.capsule_type = :eggType', {
        eggType: CapsuleType.EASTER_EGG,
      })
      .withDeleted()
      .orderBy('capsule.created_at', 'DESC')
      .getMany();

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

    const activeEggs: any[] = [];
    const expiredEggs: any[] = [];

    for (const capsule of capsules) {
      const mediaTypes = this.capsuleMediaService.getMediaTypesFromCapsule(
        capsule,
        mediaMap,
      );
      const eggItem = {
        eggId: capsule.id,
        title: capsule.title,
        content: capsule.content,
        viewCount: capsule.easterEgg?.viewCount ?? 0,
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

  private async getMyFoundEggs(user: User, sort?: string) {
    const accessLogs = await this.accessLogRepository
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.capsule', 'capsule')
      .leftJoinAndSelect('capsule.easterEgg', 'egg')
      .where('log.viewer_id = :viewerId', { viewerId: user.id })
      .andWhere('capsule.deleted_at IS NULL')
      .andWhere('capsule.capsule_type = :eggType', {
        eggType: CapsuleType.EASTER_EGG,
      })
      .orderBy('log.viewed_at', sort === 'OLDEST' ? 'ASC' : 'DESC')
      .getMany();

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
        const mediaTypes = this.capsuleMediaService.getMediaTypesFromCapsule(
          capsule,
          mediaMap,
        );
        return {
          eggId: capsule.id,
          title: capsule.title,
          content: capsule.content,
          viewCount: capsule.easterEgg?.viewCount ?? 0,
          latitude: capsule.latitude ? Number(capsule.latitude) : null,
          longitude: capsule.longitude ? Number(capsule.longitude) : null,
          hasImage: mediaTypes.includes(MediaType.IMAGE),
          hasAudio: mediaTypes.includes(MediaType.AUDIO),
          hasVideo: mediaTypes.includes(MediaType.VIDEO),
          createdDate: capsule.createdAt,
          foundDate: log.viewedAt,
        };
      });

    return {
      summary: {
        totalFoundCount: data.length,
      },
      data,
    };
  }

  private validateTextBlocks(textBlocks?: { order: number; content: string }[]) {
    if (!textBlocks || textBlocks.length === 0) {
      return null;
    }
    if (textBlocks.length > this.TEXT_BLOCK_MAX_COUNT) {
      throw new BadRequestException('TEXT_BLOCK_COUNT_EXCEEDED');
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
}
