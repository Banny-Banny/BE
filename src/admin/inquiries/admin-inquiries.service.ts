import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import {
  CustomerService,
  CustomerServiceMessage,
  User,
  AdminUser,
} from '../../entities';
import { InquirySenderType, InquiryStatus } from '../../common/enums';
import { AdminInquiryListQueryDto } from './dto/admin-inquiry-list-query.dto';
import { AdminInquiryHistoryQueryDto } from './dto/admin-inquiry-history-query.dto';

@Injectable()
export class AdminInquiriesService {
  constructor(
    @InjectRepository(CustomerService)
    private readonly customerServiceRepository: Repository<CustomerService>,
    @InjectRepository(CustomerServiceMessage)
    private readonly messageRepository: Repository<CustomerServiceMessage>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(AdminUser)
    private readonly adminRepository: Repository<AdminUser>,
  ) {}

  async listInquiries(query: AdminInquiryListQueryDto) {
    const qb = this.customerServiceRepository
      .createQueryBuilder('inquiry')
      .leftJoinAndSelect('inquiry.user', 'user')
      .where('inquiry.deleted_at IS NULL');

    if (query.status && query.status !== 'ALL') {
      qb.andWhere('inquiry.status = :status', { status: query.status });
    }

    qb.orderBy('inquiry.lastMessageAt', 'DESC')
      .addOrderBy('inquiry.createdAt', 'DESC')
      .skip(query.offset)
      .take(query.limit);

    const [items, total] = await qb.getManyAndCount();
    const roomIds = items.map((item) => item.id);
    const unreadMap = await this.countUnreadByRoom(roomIds);

    return {
      success: true,
      data: {
        items: items.map((inquiry) => ({
          id: inquiry.id,
          user: {
            id: inquiry.user?.id ?? null,
            nickname: inquiry.user?.nickname ?? null,
            email: inquiry.user?.email ?? null,
          },
          status: inquiry.status,
          isResolved: inquiry.isResolved,
          lastMessageAt: inquiry.lastMessageAt,
          lastMessagePreview: inquiry.lastMessagePreview,
          unreadCount: unreadMap.get(inquiry.id) ?? 0,
          createdAt: inquiry.createdAt,
        })),
        total,
        limit: query.limit,
        offset: query.offset,
      },
    };
  }

  async getInquiryDetail(
    inquiryId: string,
    query: AdminInquiryHistoryQueryDto,
  ) {
    const inquiry = await this.customerServiceRepository.findOne({
      where: { id: inquiryId },
      relations: ['user'],
      withDeleted: false,
    });

    if (!inquiry || inquiry.deletedAt) {
      throw new NotFoundException('문의방을 찾을 수 없습니다.');
    }

    const [messages, total] = await this.messageRepository.findAndCount({
      where: { customerServiceId: inquiryId },
      order: { createdAt: 'DESC' },
      skip: query.offset,
      take: query.limit,
      withDeleted: false,
    });

    return {
      success: true,
      data: {
        inquiry: {
          id: inquiry.id,
          status: inquiry.status,
          isResolved: inquiry.isResolved,
          title: inquiry.title,
          createdAt: inquiry.createdAt,
          lastMessageAt: inquiry.lastMessageAt,
          lastMessagePreview: inquiry.lastMessagePreview,
          user: {
            id: inquiry.user?.id ?? null,
            nickname: inquiry.user?.nickname ?? null,
            email: inquiry.user?.email ?? null,
          },
        },
        messages: messages.map((message) => ({
          id: message.id,
          senderType: message.senderType,
          senderUserId: message.senderUserId,
          senderAdminId: message.senderAdminId,
          content: message.content,
          isReadByAdmin: message.isReadByAdmin,
          isReadByUser: message.isReadByUser,
          createdAt: message.createdAt,
          updatedAt: message.updatedAt,
        })),
        total,
        limit: query.limit,
        offset: query.offset,
      },
    };
  }

  async updateStatus(inquiryId: string, status: InquiryStatus) {
    const inquiry = await this.customerServiceRepository.findOne({
      where: { id: inquiryId },
    });
    if (!inquiry || inquiry.deletedAt) {
      throw new NotFoundException('문의방을 찾을 수 없습니다.');
    }

    inquiry.status = status;
    inquiry.isResolved = status === InquiryStatus.COMPLETED;
    const saved = await this.customerServiceRepository.save(inquiry);

    return {
      success: true,
      data: {
        id: saved.id,
        status: saved.status,
        isResolved: saved.isResolved,
      },
    };
  }

  async deleteInquiry(inquiryId: string) {
    const inquiry = await this.customerServiceRepository.findOne({
      where: { id: inquiryId },
    });
    if (!inquiry || inquiry.deletedAt) {
      throw new NotFoundException('문의방을 찾을 수 없습니다.');
    }

    await this.customerServiceRepository.softRemove(inquiry);
    await this.messageRepository.softDelete({ customerServiceId: inquiryId });
    return { success: true };
  }

  async deleteMessage(inquiryId: string, messageId: string) {
    const message = await this.messageRepository.findOne({
      where: { id: messageId, customerServiceId: inquiryId },
    });
    if (!message || message.deletedAt) {
      throw new NotFoundException('메시지를 찾을 수 없습니다.');
    }

    await this.messageRepository.softRemove(message);
    return { success: true };
  }

  async updateMessage(inquiryId: string, messageId: string, content: string) {
    const message = await this.messageRepository.findOne({
      where: { id: messageId, customerServiceId: inquiryId },
    });
    if (!message || message.deletedAt) {
      throw new NotFoundException('메시지를 찾을 수 없습니다.');
    }
    if (message.senderType !== InquirySenderType.ADMIN) {
      throw new BadRequestException('관리자 메시지만 수정할 수 있습니다.');
    }

    message.content = content;
    const saved = await this.messageRepository.save(message);

    const inquiry = await this.getRoomById(inquiryId);
    if (!inquiry.lastMessageAt || saved.createdAt >= inquiry.lastMessageAt) {
      const preview = this.buildPreview(content);
      await this.touchLastMessage(inquiryId, saved.createdAt, preview, inquiry);
    }

    return {
      success: true,
      data: {
        id: saved.id,
        content: saved.content,
        updatedAt: saved.updatedAt,
      },
    };
  }

  async getRoomById(inquiryId: string) {
    const inquiry = await this.customerServiceRepository.findOne({
      where: { id: inquiryId },
    });
    if (!inquiry || inquiry.deletedAt) {
      throw new NotFoundException('문의방을 찾을 수 없습니다.');
    }
    return inquiry;
  }

  async getOrCreateRoomForUser(userId: string, initialMessage?: string) {
    const existing = await this.customerServiceRepository.findOne({
      where: {
        userId,
        deletedAt: IsNull(),
      },
      order: { lastMessageAt: 'DESC', createdAt: 'DESC' },
    });

    if (existing) {
      return existing;
    }

    const title = '1:1 문의';
    const content = initialMessage?.trim() || '문의가 시작되었습니다.';

    const inquiry = this.customerServiceRepository.create({
      userId,
      title,
      content,
      status: InquiryStatus.PENDING,
      isResolved: false,
      lastMessageAt: new Date(),
      lastMessagePreview: this.buildPreview(content),
    });

    return this.customerServiceRepository.save(inquiry);
  }

  async createMessage(params: {
    inquiryId: string;
    senderType: InquirySenderType;
    senderUserId?: string;
    senderAdminId?: string;
    content: string;
  }) {
    const inquiry = await this.getRoomById(params.inquiryId);

    if (
      params.senderType === InquirySenderType.ADMIN &&
      inquiry.status === InquiryStatus.PENDING
    ) {
      inquiry.status = InquiryStatus.IN_PROGRESS;
    }
    if (
      params.senderType === InquirySenderType.USER &&
      inquiry.status === InquiryStatus.COMPLETED
    ) {
      inquiry.status = InquiryStatus.IN_PROGRESS;
      inquiry.isResolved = false;
    }

    const message = this.messageRepository.create({
      customerServiceId: params.inquiryId,
      senderType: params.senderType,
      senderUserId: params.senderUserId ?? null,
      senderAdminId: params.senderAdminId ?? null,
      content: params.content.trim(),
      isReadByAdmin: params.senderType === InquirySenderType.ADMIN,
      isReadByUser: params.senderType === InquirySenderType.USER,
    });

    const saved = await this.messageRepository.save(message);
    await this.touchLastMessage(
      params.inquiryId,
      saved.createdAt,
      this.buildPreview(saved.content),
      inquiry,
    );

    return saved;
  }

  async markRead(inquiryId: string, reader: InquirySenderType) {
    if (reader === InquirySenderType.ADMIN) {
      await this.messageRepository
        .createQueryBuilder()
        .update(CustomerServiceMessage)
        .set({ isReadByAdmin: true })
        .where('customer_service_id = :inquiryId', { inquiryId })
        .andWhere('sender_type = :senderType', {
          senderType: InquirySenderType.USER,
        })
        .andWhere('deleted_at IS NULL')
        .execute();
    } else {
      await this.messageRepository
        .createQueryBuilder()
        .update(CustomerServiceMessage)
        .set({ isReadByUser: true })
        .where('customer_service_id = :inquiryId', { inquiryId })
        .andWhere('sender_type = :senderType', {
          senderType: InquirySenderType.ADMIN,
        })
        .andWhere('deleted_at IS NULL')
        .execute();
    }
  }

  async getUserById(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException('유저를 찾을 수 없습니다.');
    }
    return user;
  }

  async getAdminById(adminId: string) {
    const admin = await this.adminRepository.findOne({
      where: { id: adminId },
    });
    if (!admin) {
      throw new NotFoundException('관리자를 찾을 수 없습니다.');
    }
    return admin;
  }

  private async countUnreadByRoom(roomIds: string[]) {
    if (!roomIds.length) {
      return new Map<string, number>();
    }

    const unreadRows = await this.messageRepository
      .createQueryBuilder('message')
      .select('message.customer_service_id', 'roomId')
      .addSelect('COUNT(*)', 'count')
      .where('message.customer_service_id IN (:...roomIds)', { roomIds })
      .andWhere('message.sender_type = :senderType', {
        senderType: InquirySenderType.USER,
      })
      .andWhere('message.is_read_by_admin = false')
      .andWhere('message.deleted_at IS NULL')
      .groupBy('message.customer_service_id')
      .getRawMany<{ roomId: string; count: string }>();

    return new Map(unreadRows.map((row) => [row.roomId, Number(row.count)]));
  }

  private buildPreview(content: string) {
    return content.trim().slice(0, 200);
  }

  private async touchLastMessage(
    inquiryId: string,
    lastMessageAt: Date,
    preview: string,
    inquiry?: CustomerService,
  ) {
    const target =
      inquiry ??
      (await this.customerServiceRepository.findOne({
        where: { id: inquiryId },
      }));
    if (!target) {
      return;
    }

    target.lastMessageAt = lastMessageAt;
    target.lastMessagePreview = preview;
    if (target.status === InquiryStatus.COMPLETED) {
      target.isResolved = true;
    }
    await this.customerServiceRepository.save(target);
  }
}
