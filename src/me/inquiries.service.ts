import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CustomerService, CustomerServiceMessage } from '../entities';
import { InquirySenderType } from '../common/enums';
import { PaginationQueryDto } from './dto/pagination.dto';
import { UserInquiryListItemDto } from './dto/user-inquiry-list-item.dto';
import { PaginatedUserInquiryResponseDto } from './dto/user-inquiry-list-response.dto';
import {
  UserInquiryDetailDto,
  UserInquiryDetailResponseDto,
} from './dto/user-inquiry-detail-response.dto';
import { UserInquiryMessageDto } from './dto/user-inquiry-message.dto';

@Injectable()
export class InquiriesService {
  constructor(
    @InjectRepository(CustomerService)
    private readonly customerServiceRepository: Repository<CustomerService>,
    @InjectRepository(CustomerServiceMessage)
    private readonly messageRepository: Repository<CustomerServiceMessage>,
  ) {}

  async listInquiries(
    userId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedUserInquiryResponseDto> {
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;

    const qb = this.customerServiceRepository
      .createQueryBuilder('inquiry')
      .where('inquiry.user_id = :userId', { userId })
      .andWhere('inquiry.deleted_at IS NULL')
      .orderBy('inquiry.last_message_at', 'DESC')
      .addOrderBy('inquiry.created_at', 'DESC')
      .skip(offset)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();
    const roomIds = items.map((item) => item.id);
    const unreadMap = await this.countUnreadByRoom(roomIds);

    const resultItems = items.map(
      (inquiry) =>
        new UserInquiryListItemDto({
          id: inquiry.id,
          status: inquiry.status,
          isResolved: inquiry.isResolved,
          title: inquiry.title,
          lastMessageAt: inquiry.lastMessageAt ?? null,
          lastMessagePreview: inquiry.lastMessagePreview ?? null,
          unreadCount: unreadMap.get(inquiry.id) ?? 0,
          createdAt: inquiry.createdAt,
        }),
    );

    return new PaginatedUserInquiryResponseDto(
      resultItems,
      total,
      limit,
      offset,
    );
  }

  async getInquiryDetail(
    userId: string,
    inquiryId: string,
    query: PaginationQueryDto,
  ): Promise<UserInquiryDetailResponseDto> {
    const inquiry = await this.customerServiceRepository.findOne({
      where: { id: inquiryId, userId },
      withDeleted: false,
    });

    if (!inquiry || inquiry.deletedAt) {
      throw new NotFoundException('문의방을 찾을 수 없습니다.');
    }

    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;

    const [messages, total] = await this.messageRepository.findAndCount({
      where: { customerServiceId: inquiryId },
      order: { createdAt: 'DESC' },
      skip: offset,
      take: limit,
      withDeleted: false,
    });

    const messageItems = messages.map(
      (message) =>
        new UserInquiryMessageDto({
          id: message.id,
          senderType: message.senderType,
          senderUserId: message.senderUserId ?? null,
          senderAdminId: message.senderAdminId ?? null,
          content: message.content,
          isReadByAdmin: message.isReadByAdmin,
          isReadByUser: message.isReadByUser,
          createdAt: message.createdAt,
          updatedAt: message.updatedAt,
        }),
    );

    return new UserInquiryDetailResponseDto({
      inquiry: new UserInquiryDetailDto({
        id: inquiry.id,
        status: inquiry.status,
        isResolved: inquiry.isResolved,
        title: inquiry.title,
        createdAt: inquiry.createdAt,
        lastMessageAt: inquiry.lastMessageAt ?? null,
        lastMessagePreview: inquiry.lastMessagePreview ?? null,
      }),
      messages: messageItems,
      total,
      limit,
      offset,
    });
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
        senderType: InquirySenderType.ADMIN,
      })
      .andWhere('message.is_read_by_user = false')
      .andWhere('message.deleted_at IS NULL')
      .groupBy('message.customer_service_id')
      .getRawMany<{ roomId: string; count: string }>();

    return new Map(unreadRows.map((row) => [row.roomId, Number(row.count)]));
  }
}
