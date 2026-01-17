import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CapsuleAccessLog } from '../entities';

@Injectable()
export class CapsuleAccessService {
  constructor(
    @InjectRepository(CapsuleAccessLog)
    private readonly accessLogRepository: Repository<CapsuleAccessLog>,
  ) {}

  async logCapsuleAccess(capsuleId: string, viewerId: string): Promise<void> {
    try {
      await this.accessLogRepository.insert({ capsuleId, viewerId });
    } catch {
      // 동일 유저 중복 조회는 Unique 제약에 의해 무시됨
    }
  }
}
