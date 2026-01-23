import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notice } from '../entities';
import { MediaService } from '../media/media.service';
import { CreateNoticeDto } from './dto/create-notice.dto';
import { NoticeListQueryDto } from './dto/notice-list-query.dto';
import { UpdateNoticeDto } from './dto/update-notice.dto';
import { MulterFile } from '../media/types/multer-file.interface';

@Injectable()
export class NoticesService {
  constructor(
    @InjectRepository(Notice)
    private readonly noticeRepository: Repository<Notice>,
    private readonly mediaService: MediaService,
  ) {}

  async listNotices(query: NoticeListQueryDto) {
    const qb = this.noticeRepository.createQueryBuilder('notice');

    qb.where('notice.is_visible = true');

    if (query.search) {
      qb.andWhere(
        '(notice.title ILIKE :search OR notice.content ILIKE :search)',
        {
          search: `%${query.search}%`,
        },
      );
    }

    const [items, total] = await qb
      .orderBy('notice.is_pinned', 'DESC')
      .addOrderBy('notice.created_at', 'DESC')
      .skip(query.offset)
      .take(query.limit)
      .getManyAndCount();

    const itemsWithSigned = await Promise.all(
      items.map(async (notice) => ({
        id: notice.id,
        title: notice.title,
        imageUrl: await this.resolveNoticeImageUrl(notice.imageUrl),
        isPinned: notice.isPinned,
        isVisible: notice.isVisible,
        createdAt: notice.createdAt,
      })),
    );

    return {
      success: true,
      data: {
        items: itemsWithSigned,
        total,
        limit: query.limit,
        offset: query.offset,
      },
    };
  }

  async getNoticeDetail(noticeId: string) {
    const notice = await this.noticeRepository.findOne({
      where: { id: noticeId, isVisible: true },
    });

    if (!notice) {
      throw new NotFoundException('공지사항을 찾을 수 없습니다.');
    }

    return {
      success: true,
      data: {
        id: notice.id,
        title: notice.title,
        content: notice.content,
        imageUrl: await this.resolveNoticeImageUrl(notice.imageUrl),
        isPinned: notice.isPinned,
        isVisible: notice.isVisible,
        createdAt: notice.createdAt,
        updatedAt: notice.updatedAt,
      },
    };
  }

  async createNotice(adminId: string, dto: CreateNoticeDto, file?: MulterFile) {
    let imageUrl = dto.imageUrl ?? null;

    if (file) {
      const uploaded = await this.mediaService.uploadPublicImageFile(
        adminId,
        file,
      );
      imageUrl = uploaded.object_key;
    }

    const notice = this.noticeRepository.create({
      title: dto.title,
      content: dto.content,
      imageUrl,
      isPinned: dto.isPinned ?? false,
      isVisible: dto.isVisible ?? true,
    });

    const saved = await this.noticeRepository.save(notice);

    return {
      success: true,
      data: {
        id: saved.id,
        title: saved.title,
        content: saved.content,
        imageUrl: await this.resolveNoticeImageUrl(saved.imageUrl),
        isPinned: saved.isPinned,
        isVisible: saved.isVisible,
        createdAt: saved.createdAt,
      },
    };
  }

  async updateNotice(
    adminId: string,
    noticeId: string,
    dto: UpdateNoticeDto,
    file?: MulterFile,
  ) {
    const notice = await this.noticeRepository.findOne({
      where: { id: noticeId },
    });

    if (!notice) {
      throw new NotFoundException('공지사항을 찾을 수 없습니다.');
    }

    const updates: Partial<Notice> = {};
    if (dto.title !== undefined) updates.title = dto.title;
    if (dto.content !== undefined) updates.content = dto.content;
    if (dto.imageUrl !== undefined) updates.imageUrl = dto.imageUrl;
    if (dto.isPinned !== undefined) updates.isPinned = dto.isPinned;
    if (dto.isVisible !== undefined) updates.isVisible = dto.isVisible;

    if (file) {
      const uploaded = await this.mediaService.uploadPublicImageFile(
        adminId,
        file,
      );
      updates.imageUrl = uploaded.object_key;
    }

    if (!Object.keys(updates).length) {
      throw new BadRequestException('수정할 데이터가 없습니다.');
    }

    Object.assign(notice, updates);
    const saved = await this.noticeRepository.save(notice);

    return {
      success: true,
      data: {
        id: saved.id,
        title: saved.title,
        content: saved.content,
        imageUrl: await this.resolveNoticeImageUrl(saved.imageUrl),
        isPinned: saved.isPinned,
        isVisible: saved.isVisible,
        updatedAt: saved.updatedAt,
      },
    };
  }

  private async resolveNoticeImageUrl(
    imageUrl: string | null,
  ): Promise<string | null> {
    if (!imageUrl) return null;

    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      const marker = 'amazonaws.com/';
      const index = imageUrl.indexOf(marker);
      if (index === -1) {
        return imageUrl;
      }
      const objectKey = imageUrl.slice(index + marker.length);
      if (!objectKey) return imageUrl;
      return await this.mediaService.getSignedUrlByObjectKey(objectKey);
    }

    return await this.mediaService.getSignedUrlByObjectKey(imageUrl);
  }

  async deleteNotice(noticeId: string) {
    const notice = await this.noticeRepository.findOne({
      where: { id: noticeId },
    });

    if (!notice) {
      throw new NotFoundException('공지사항을 찾을 수 없습니다.');
    }

    await this.noticeRepository.softDelete(noticeId);
    return { success: true };
  }
}
