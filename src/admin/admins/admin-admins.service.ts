import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminUser } from '../../entities';
import { AdminAccountListQueryDto } from './dto/admin-account-list-query.dto';

@Injectable()
export class AdminAdminsService {
  constructor(
    @InjectRepository(AdminUser)
    private readonly adminRepository: Repository<AdminUser>,
  ) {}

  async listAdmins(query: AdminAccountListQueryDto) {
    const qb = this.adminRepository.createQueryBuilder('admin');

    if (query.search) {
      qb.andWhere('(admin.email ILIKE :search OR admin.name ILIKE :search)', {
        search: `%${query.search}%`,
      });
    }

    if (query.status === 'ACTIVE') {
      qb.andWhere('admin.is_active = true');
    } else if (query.status === 'INACTIVE') {
      qb.andWhere('admin.is_active = false');
    }

    const [items, total] = await qb
      .orderBy('admin.created_at', 'DESC')
      .skip(query.offset)
      .take(query.limit)
      .getManyAndCount();

    return {
      success: true,
      data: {
        items: items.map((admin) => ({
          adminId: admin.id,
          email: admin.email,
          name: admin.name,
          role: admin.role,
          isActive: admin.isActive,
          createdAt: admin.createdAt,
        })),
        total,
        limit: query.limit,
        offset: query.offset,
      },
    };
  }
}
