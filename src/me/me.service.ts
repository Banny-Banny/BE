import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import {
  User,
  Capsule,
  CapsuleParticipantSlot,
  CapsuleEntry,
} from '../entities';
import { MediaService } from '../media/media.service';
import { MulterFile } from '../media/types/multer-file.interface';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { ProfileResponseDto } from './dto/profile-response.dto';
import {
  CapsuleListItemDto,
  PaginatedCapsuleResponseDto,
} from './dto/capsule-list-response.dto';
import { MediaType } from '../common/enums';

/**
 * 마이페이지 서비스
 * 프로필 조회 및 수정, 알림 설정 관리
 */
@Injectable()
export class MeService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Capsule)
    private readonly capsuleRepository: Repository<Capsule>,
    @InjectRepository(CapsuleParticipantSlot)
    private readonly slotRepository: Repository<CapsuleParticipantSlot>,
    @InjectRepository(CapsuleEntry)
    private readonly entryRepository: Repository<CapsuleEntry>,
    private readonly mediaService: MediaService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * 내 프로필 조회
   * @param userId 사용자 ID
   * @returns 프로필 정보
   */
  async getMyProfile(userId: string): Promise<ProfileResponseDto> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: [
        'id',
        'nickname',
        'email',
        'phoneNumber',
        'profileImg',
        'isPushAgreed',
        'isMarketingAgreed',
        'eggSlots',
        'createdAt',
      ],
    });

    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    return new ProfileResponseDto(user);
  }

  /**
   * 프로필 수정 (닉네임, 이메일)
   * @param userId 사용자 ID
   * @param dto 수정할 프로필 정보
   * @returns 수정된 프로필 정보
   */
  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<ProfileResponseDto> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    // 닉네임 중복 체크
    if (dto.nickname && dto.nickname !== user.nickname) {
      const existingUser = await this.userRepository.findOne({
        where: { nickname: dto.nickname, id: Not(userId) },
      });

      if (existingUser) {
        throw new ConflictException('이미 사용 중인 닉네임입니다.');
      }

      user.nickname = dto.nickname;
    }

    // 이메일 수정
    if (dto.email !== undefined) {
      user.email = dto.email;
    }

    await this.userRepository.save(user);

    return this.getMyProfile(userId);
  }

  /**
   * 알림 설정 수정
   * @param userId 사용자 ID
   * @param dto 수정할 알림 설정
   */
  async updateSettings(userId: string, dto: UpdateSettingsDto): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    if (dto.isPushAgreed !== undefined) {
      user.isPushAgreed = dto.isPushAgreed;
    }

    if (dto.isMarketingAgreed !== undefined) {
      user.isMarketingAgreed = dto.isMarketingAgreed;
    }

    await this.userRepository.save(user);
  }

  /**
   * 프로필 이미지 직접 업로드 (multipart/form-data)
   * MediaService를 통해 S3에 업로드하고 즉시 DB 반영
   * @param userId 사용자 ID
   * @param file 업로드 파일
   * @returns 업로드된 이미지 URL
   */
  async uploadProfileImage(
    userId: string,
    file: MulterFile,
  ): Promise<{ profileImageUrl: string }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    // MediaService를 통해 S3에 업로드
    const media = await this.mediaService.uploadMulterFile(
      userId,
      file,
      MediaType.IMAGE,
    );

    // S3 URL 구성
    const bucket = this.configService.get<string>('S3_BUCKET');
    const region = this.configService.get<string>(
      'AWS_REGION',
      'ap-northeast-2',
    );
    const profileImageUrl = `https://${bucket}.s3.${region}.amazonaws.com/${media.objectKey}`;

    // User 프로필 이미지 업데이트
    await this.updateProfileImageUrl(userId, profileImageUrl);

    return { profileImageUrl };
  }

  /**
   * 프로필 이미지 URL 업데이트
   * @param userId 사용자 ID
   * @param imageUrl 이미지 URL
   */
  async updateProfileImageUrl(userId: string, imageUrl: string): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    user.profileImg = imageUrl;
    await this.userRepository.save(user);
  }

  /**
   * 참여중인 타임캡슐 리스트 조회
   * @param userId 사용자 ID
   * @param limit 페이지당 아이템 수
   * @param offset 건너뛸 아이템 수
   * @returns 타임캡슐 리스트 (페이지네이션)
   */
  async getMyCapsules(
    userId: string,
    limit: number = 20,
    offset: number = 0,
  ): Promise<PaginatedCapsuleResponseDto> {
    // 1. 참여중인 캡슐 ID 조회 (CapsuleParticipantSlot에서)
    const participatedSlots = await this.slotRepository.find({
      where: { userId },
      select: ['capsuleId'],
    });

    const participatedCapsuleIds = participatedSlots.map(
      (slot) => slot.capsuleId,
    );

    // 2. 소유 캡슐 + 참여 캡슐 통합 조회
    const queryBuilder = this.capsuleRepository
      .createQueryBuilder('capsule')
      .where('capsule.userId = :userId', { userId });

    // 참여 캡슐이 있으면 OR 조건 추가
    if (participatedCapsuleIds.length > 0) {
      queryBuilder.orWhere('capsule.id IN (:...capsuleIds)', {
        capsuleIds: participatedCapsuleIds,
      });
    }

    // 3. 페이지네이션 및 정렬
    const [capsules, total] = await queryBuilder
      .orderBy('capsule.createdAt', 'DESC')
      .skip(offset)
      .take(limit)
      .getManyAndCount();

    // 4. 각 캡슐의 참여자 수 및 내 작성 상태 조회
    const capsuleItems = await Promise.all(
      capsules.map(async (capsule) => {
        // 참여자 수 계산
        const participantCount = await this.slotRepository.count({
          where: { capsuleId: capsule.id },
        });

        // 내 작성 상태 확인
        const myEntry = await this.entryRepository.findOne({
          where: { capsuleId: capsule.id, userId },
        });

        return new CapsuleListItemDto({
          id: capsule.id,
          title: capsule.title,
          status: capsule.roomStatus || 'WAITING',
          openDate: capsule.openAt,
          participantCount,
          myWriteStatus: !!myEntry,
          createdAt: capsule.createdAt,
        });
      }),
    );

    return new PaginatedCapsuleResponseDto(capsuleItems, total, limit, offset);
  }
}
