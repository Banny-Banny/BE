import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Capsule, CapsuleEntry, Media, User } from '../entities';
import { Product } from '../entities/product.entity';
import { MediaType } from '../common/enums';

@Injectable()
export class CapsuleMediaService {
  constructor(
    @InjectRepository(Media)
    private readonly mediaRepository: Repository<Media>,
  ) {}

  async resolveMediaByIds(
    user: User,
    mediaIds: string[],
    product: Product | null,
  ) {
    const uniqueIds = Array.from(new Set(mediaIds));
    const limit = product?.maxMediaCount ?? 3;
    if (limit > 0 && uniqueIds.length > limit) {
      throw new BadRequestException('MEDIA_LIMIT_EXCEEDED');
    }

    const mediaEntities = await this.mediaRepository.find({
      where: {
        id: In(uniqueIds),
        userId: user.id,
      },
    });
    if (mediaEntities.length !== uniqueIds.length) {
      throw new BadRequestException('MEDIA_NOT_FOUND');
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
  buildMediaItems(capsule: Capsule, mediaEntities?: Media[]) {
    const entityMap =
      mediaEntities?.reduce<Map<string, Media>>((map, m) => {
        map.set(m.id, m);
        return map;
      }, new Map<string, Media>()) ?? new Map<string, Media>();

    if (!capsule.mediaItemIds || capsule.mediaItemIds.length === 0) {
      return [];
    }

    return capsule.mediaItemIds.map((id, idx) => {
      const media = entityMap.get(id);
      const fallbackType = capsule.mediaTypes?.[idx] ?? null;
      return {
        media_id: id,
        type: media?.type ?? fallbackType ?? null,
        object_key: media?.objectKey ?? null,
      };
    });
  }

  buildEntryMediaItems(entry: CapsuleEntry | null, mediaMap: Map<string, Media>) {
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

  getMediaTypesFromCapsule(capsule: Capsule, mediaMap: Map<string, Media>) {
    if (!capsule.mediaItemIds || capsule.mediaItemIds.length === 0) {
      return [];
    }

    const types: MediaType[] = [];
    for (let i = 0; i < capsule.mediaItemIds.length; i++) {
      const mediaId = capsule.mediaItemIds[i];
      const media = mediaMap.get(mediaId);
      const mediaType = media?.type ?? capsule.mediaTypes?.[i];
      if (mediaType && !types.includes(mediaType)) {
        types.push(mediaType);
      }
    }
    return types;
  }
}
