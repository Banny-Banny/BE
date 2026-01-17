import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CapsuleAccessLog, User } from '../../entities';
import { AdminUserListQueryDto } from './dto/admin-user-list-query.dto';
import { AdminUserUpdateDto } from './dto/admin-user-update.dto';

@Injectable()
export class AdminUsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(CapsuleAccessLog)
    private readonly accessLogRepository: Repository<CapsuleAccessLog>,
  ) {}

  async listUsers(query: AdminUserListQueryDto) {
    const qb = this.userRepository.createQueryBuilder('user').withDeleted();

    if (query.search) {
      qb.andWhere('(user.nickname ILIKE :search OR user.email ILIKE :search)', {
        search: `%${query.search}%`,
      });
    }

    if (query.status === 'ACTIVE') {
      qb.andWhere('user.is_active = true');
      qb.andWhere('user.deleted_at IS NULL');
    } else if (query.status === 'INACTIVE') {
      qb.andWhere('(user.is_active = false OR user.deleted_at IS NOT NULL)');
    }

    if (query.startDate) {
      const start = new Date(query.startDate);
      start.setHours(0, 0, 0, 0);
      qb.andWhere('user.created_at >= :startDate', {
        startDate: start,
      });
    }
    if (query.endDate) {
      const end = new Date(query.endDate);
      end.setHours(23, 59, 59, 999);
      qb.andWhere('user.created_at <= :endDate', {
        endDate: end,
      });
    }

    const [items, total] = await qb
      .orderBy('user.created_at', 'DESC')
      .skip(query.offset)
      .take(query.limit)
      .getManyAndCount();

    return {
      success: true,
      data: {
        items: items.map((user) => ({
          id: user.id,
          nickname: user.nickname,
          email: user.email,
          phoneNumber: user.phoneNumber,
          isActive: user.isActive,
          provider: user.provider,
          createdAt: user.createdAt,
          deletedAt: user.deletedAt,
        })),
        total,
        limit: query.limit,
        offset: query.offset,
      },
    };
  }

  async getUserDetail(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      withDeleted: true,
    });

    if (!user) {
      throw new NotFoundException('유저를 찾을 수 없습니다.');
    }

    const logs = await this.accessLogRepository
      .createQueryBuilder('log')
      .leftJoin('log.capsule', 'capsule')
      .select([
        'log.id AS id',
        'log.capsule_id AS capsuleId',
        'log.viewed_at AS viewedAt',
        'capsule.title AS capsuleTitle',
      ])
      .where('log.viewer_id = :userId', { userId })
      .orderBy('log.viewed_at', 'DESC')
      .take(20)
      .getRawMany<{
        id: string;
        capsuleId: string;
        viewedAt: Date;
        capsuleTitle: string;
      }>();

    const activityLogs = logs.map((log) => ({
      id: log.id,
      capsuleId: log.capsuleId,
      capsuleTitle: log.capsuleTitle,
      viewedAt: log.viewedAt,
    }));

    return {
      success: true,
      data: {
        user: {
          id: user.id,
          nickname: user.nickname,
          email: user.email,
          phoneNumber: user.phoneNumber,
          profileImg: user.profileImg,
          provider: user.provider,
          isActive: user.isActive,
          createdAt: user.createdAt,
          deletedAt: user.deletedAt,
          lastKakaoFriendsSyncAt: user.lastKakaoFriendsSyncAt,
        },
        activityLogs,
        deviceInfo: {
          pushToken: user.pushToken,
          isPushAgreed: user.isPushAgreed,
          isMarketingAgreed: user.isMarketingAgreed,
        },
      },
    };
  }

  async updateUser(userId: string, dto: AdminUserUpdateDto) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      withDeleted: true,
    });

    if (!user) {
      throw new NotFoundException('유저를 찾을 수 없습니다.');
    }

    const updates: Partial<User> = {};
    if (dto.nickname !== undefined) updates.nickname = dto.nickname;
    if (dto.email !== undefined) updates.email = dto.email;
    if (dto.phoneNumber !== undefined) updates.phoneNumber = dto.phoneNumber;
    if (dto.profileImg !== undefined) updates.profileImg = dto.profileImg;
    if (dto.isMarketingAgreed !== undefined)
      updates.isMarketingAgreed = dto.isMarketingAgreed;
    if (dto.isPushAgreed !== undefined) updates.isPushAgreed = dto.isPushAgreed;

    if (!Object.keys(updates).length) {
      throw new BadRequestException('수정할 데이터가 없습니다.');
    }

    Object.assign(user, updates);
    const saved = await this.userRepository.save(user);

    return {
      success: true,
      data: {
        id: saved.id,
        nickname: saved.nickname,
        email: saved.email,
        phoneNumber: saved.phoneNumber,
        profileImg: saved.profileImg,
        isActive: saved.isActive,
      },
    };
  }

  async blockUser(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      withDeleted: true,
    });
    if (!user) {
      throw new NotFoundException('유저를 찾을 수 없습니다.');
    }

    user.isActive = false;
    await this.userRepository.save(user);
    return { success: true };
  }

  async unblockUser(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      withDeleted: true,
    });
    if (!user) {
      throw new NotFoundException('유저를 찾을 수 없습니다.');
    }

    user.isActive = true;
    await this.userRepository.save(user);
    return { success: true };
  }

  async deactivateUser(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      withDeleted: true,
    });
    if (!user) {
      throw new NotFoundException('유저를 찾을 수 없습니다.');
    }

    user.isActive = false;
    await this.userRepository.save(user);
    await this.userRepository.softRemove(user);
    return { success: true };
  }
}
