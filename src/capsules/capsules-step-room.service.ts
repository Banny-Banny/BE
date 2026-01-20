import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { DataSource, Repository, IsNull, EntityManager } from 'typeorm';
import { Capsule } from '../entities/capsule.entity';
import { User } from '../entities/user.entity';
import { ProductType } from '../entities/product.entity';
import {
  CapsuleType,
  OrderStatus,
  TimeOption,
  RoomStatus,
} from '../common/enums';
import { MediaType } from '../common/enums';
import { CapsuleParticipantSlot, Order, TimeCapsule } from '../entities';
import {
  StepRoomResponseDto,
  StepRoomDetailDto,
} from './dto/step-room-response.dto';
import { StepRoomSettingsResponseDto } from './dto/step-room-settings.dto';
import { SaveContentDto } from './dto/save-content.dto';
import { ContentResponseDto } from './dto/content-response.dto';
import { PatchContentDto } from './dto/patch-content.dto';
import { PatchContentResponseDto } from './dto/patch-content-response.dto';
import { SubmitCapsuleResponseDto } from './dto/submit-capsule-response.dto';
import { JoinStepRoomResponseDto } from './dto/join-step-room.dto';
import { MediaService } from '../media/media.service';
import { TimeCapsuleService } from './time-capsule.service';
import { GetMyContentResponseDto } from './dto/get-my-content-response.dto';

// Multer 파일 타입 정의
interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/**
 * Step Room (대기실) 관련 기능을 담당하는 서비스
 * - 대기실 생성 및 조회
 * - 참여자 콘텐츠 저장
 * - 타임캡슐 최종 제출 (매장)
 */
@Injectable()
export class CapsulesStepRoomService {
  constructor(
    @InjectRepository(Capsule)
    private readonly capsuleRepository: Repository<Capsule>,
    @InjectRepository(TimeCapsule)
    private readonly timeCapsuleRepository: Repository<TimeCapsule>,
    @InjectRepository(CapsuleParticipantSlot)
    private readonly slotRepository: Repository<CapsuleParticipantSlot>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly mediaService: MediaService,
    private readonly timeCapsuleService: TimeCapsuleService,
  ) {}

  // ==========================================
  // Private 헬퍼 메서드
  // ==========================================

  /**
   * 초대 코드 생성 (6자리 영숫자, 혼동 문자 제외)
   */
  private generateInviteCode(): string {
    const chars = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  /**
   * 참여 슬롯 생성
   */
  private async createParticipantSlotsForStepRoom(
    capsuleId: string,
    hostUserId: string,
    headcount: number,
    manager: EntityManager,
  ): Promise<void> {
    const slots: Partial<CapsuleParticipantSlot>[] = [];

    for (let i = 0; i < headcount; i++) {
      const slot: Partial<CapsuleParticipantSlot> = {
        capsuleId: capsuleId,
        userId: i === 0 ? hostUserId : null,
        slotIndex: i,
        assignedAt: i === 0 ? new Date() : null,
      };
      slots.push(slot);
    }

    await manager.save(CapsuleParticipantSlot, slots);
  }

  /**
   * TimeOption에 따른 openAt 계산
   */
  private calculateOpenDate(timeOption: TimeOption): Date {
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
      default:
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    }
  }

  /**
   * 스텝룸 접근 권한 검증
   */
  private async validateStepRoomAccess(
    capsule: Capsule,
    userId: string,
    inviteCode?: string,
  ): Promise<void> {
    if (capsule.userId === userId) {
      return;
    }

    const existingSlot = await this.slotRepository.findOne({
      where: { capsuleId: capsule.id, userId },
    });

    if (existingSlot) {
      return;
    }

    const timeCapsule = capsule.timeCapsule;
    if (timeCapsule?.inviteCode && inviteCode === timeCapsule.inviteCode) {
      return;
    }

    throw new ForbiddenException({
      success: false,
      error: 'UNAUTHORIZED_ACCESS',
      message: '이 캡슐에 접근할 권한이 없습니다',
    });
  }

  /**
   * 스텝룸 인원 제한 검증
   */
  private async validateStepRoomParticipantLimit(
    capsule: Capsule,
    userId: string,
  ): Promise<void> {
    const existingSlot = await this.slotRepository.findOne({
      where: { capsuleId: capsule.id, userId },
    });

    if (existingSlot) {
      return;
    }

    const slots = await this.slotRepository.find({
      where: { capsuleId: capsule.id },
    });

    const currentParticipants = slots.filter((s) => s.userId !== null).length;
    const maxParticipants = capsule.timeCapsule?.order?.headcount ?? 0;

    if (maxParticipants > 0 && currentParticipants >= maxParticipants) {
      throw new ForbiddenException({
        success: false,
        error: 'PARTICIPANT_LIMIT_EXCEEDED',
        message: '캡슐 참여 인원이 초과되었습니다',
        data: {
          max_participants: maxParticipants,
          current_participants: currentParticipants,
        },
      });
    }
  }

  /**
   * 스텝룸 미디어 설정 검증
   */
  private validateStepRoomMediaSettings(
    order: Order,
    files: {
      images?: MulterFile[];
      music?: MulterFile[];
      video?: MulterFile[];
    },
  ): void {
    if (files.music && files.music.length > 0 && !order.addMusic) {
      throw new BadRequestException({
        success: false,
        error: 'MUSIC_NOT_ALLOWED',
        message: '이 캡슐은 음성 추가를 허용하지 않습니다',
      });
    }

    if (files.video && files.video.length > 0 && !order.addVideo) {
      throw new BadRequestException({
        success: false,
        error: 'VIDEO_NOT_ALLOWED',
        message: '이 캡슐은 동영상 추가를 허용하지 않습니다',
      });
    }

    if (files.images && files.images.length > 0) {
      // photoCount는 이미 '인당 개수'이므로 그대로 사용
      const maxImagesPerPerson = order.photoCount;

      const uploadedCount = files.images.length;

      if (uploadedCount > maxImagesPerPerson) {
        throw new BadRequestException({
          success: false,
          error: 'IMAGE_LIMIT_EXCEEDED',
          message: `사진은 최대 ${maxImagesPerPerson}장까지 업로드할 수 있습니다`,
          data: {
            max_images: maxImagesPerPerson,
            uploaded_images: uploadedCount,
          },
        });
      }
    }

    // 전체 미디어 개수는 주문의 설정에 따라 자동으로 제한됨
    // (photoCount + addMusic + addVideo)
    // 개별 검증만으로 충분함
  }

  /**
   * 스텝룸 콘텐츠 저장 (트랜잭션)
   */
  private async saveStepRoomContentTransaction(
    capsule: Capsule,
    userId: string,
    user: User,
    saveContentDto: SaveContentDto,
    files: {
      images?: MulterFile[];
      music?: MulterFile[];
      video?: MulterFile[];
    },
  ): Promise<ContentResponseDto> {
    return await this.dataSource.transaction(async (manager) => {
      const slotRepo = manager.getRepository(CapsuleParticipantSlot);

      let slot = await slotRepo.findOne({
        where: { capsuleId: capsule.id, userId },
      });

      if (slot) {
        slot.imageIds = null;
        slot.musicId = null;
        slot.videoId = null;
      } else {
        const emptySlot = await slotRepo.findOne({
          where: { capsuleId: capsule.id, userId: IsNull() },
          order: { slotIndex: 'ASC' },
        });

        if (emptySlot) {
          slot = emptySlot;
          slot.userId = userId;
          slot.assignedAt = new Date();
        } else {
          throw new ConflictException({
            success: false,
            error: 'SLOTS_FULL',
            message: '모든 슬롯이 이미 배정되었습니다',
          });
        }
      }

      slot.nickname = user.nickname || '익명';
      slot.textMessage = saveContentDto.text_message;

      const uploadedImageIds: string[] = [];
      if (files.images && files.images.length > 0) {
        for (const imageFile of files.images) {
          const media = await this.mediaService.uploadMulterFile(
            userId,
            imageFile,
            MediaType.IMAGE,
          );
          uploadedImageIds.push(media.id);
        }
      }
      slot.imageIds = uploadedImageIds.length > 0 ? uploadedImageIds : null;

      if (files.music && files.music.length > 0) {
        const media = await this.mediaService.uploadMulterFile(
          userId,
          files.music[0],
          MediaType.AUDIO,
        );
        slot.musicId = media.id;
      }

      if (files.video && files.video.length > 0) {
        const media = await this.mediaService.uploadMulterFile(
          userId,
          files.video[0],
          MediaType.VIDEO,
        );
        slot.videoId = media.id;
      }

      slot.status = 'COMPLETED';

      await slotRepo.save(slot);

      return {
        success: true,
        data: {
          user_id: userId,
          nickname: slot.nickname,
          status: slot.status,
          saved_at: slot.updatedAt,
          uploaded_images: uploadedImageIds.length,
          uploaded_music: !!slot.musicId,
          uploaded_video: !!slot.videoId,
        },
      };
    });
  }

  /**
   * 스텝룸 콘텐츠 부분 수정 (트랜잭션)
   */
  private async patchStepRoomContentTransaction(
    capsule: Capsule,
    userId: string,
    user: User,
    patchContentDto: PatchContentDto,
    files: {
      images?: MulterFile[];
      music?: MulterFile[];
      video?: MulterFile[];
    },
  ): Promise<PatchContentResponseDto> {
    return await this.dataSource.transaction(async (manager) => {
      const slotRepo = manager.getRepository(CapsuleParticipantSlot);

      const slot = await slotRepo.findOne({
        where: { capsuleId: capsule.id, userId },
      });

      if (!slot) {
        throw new NotFoundException({
          success: false,
          error: 'CONTENT_NOT_FOUND',
          message: '수정할 콘텐츠가 없습니다. POST로 먼저 저장해주세요',
        });
      }

      if (slot.status === 'PENDING' && !slot.textMessage) {
        throw new NotFoundException({
          success: false,
          error: 'CONTENT_NOT_FOUND',
          message: '수정할 콘텐츠가 없습니다. POST로 먼저 저장해주세요',
        });
      }

      slot.nickname = user.nickname || '익명';

      if (typeof patchContentDto.text_message !== 'undefined') {
        slot.textMessage = patchContentDto.text_message;
      }

      if (files.images && files.images.length > 0) {
        const uploadedImageIds: string[] = [];
        for (const imageFile of files.images) {
          const media = await this.mediaService.uploadMulterFile(
            userId,
            imageFile,
            MediaType.IMAGE,
          );
          uploadedImageIds.push(media.id);
        }
        slot.imageIds = uploadedImageIds;
      }

      if (files.music && files.music.length > 0) {
        const media = await this.mediaService.uploadMulterFile(
          userId,
          files.music[0],
          MediaType.AUDIO,
        );
        slot.musicId = media.id;
      }

      if (files.video && files.video.length > 0) {
        const media = await this.mediaService.uploadMulterFile(
          userId,
          files.video[0],
          MediaType.VIDEO,
        );
        slot.videoId = media.id;
      }

      slot.status = 'COMPLETED';

      await slotRepo.save(slot);

      return {
        success: true,
        data: {
          user_id: userId,
          nickname: slot.nickname,
          status: slot.status,
          updated_at: slot.updatedAt,
          uploaded_images: slot.imageIds ? slot.imageIds.length : 0,
          uploaded_music: !!slot.musicId,
          uploaded_video: !!slot.videoId,
        },
      };
    });
  }

  /**
   * 이미 제출된 캡슐인지 확인
   */
  private validateNotAlreadySubmitted(capsule: Capsule): void {
    if (capsule.timeCapsule?.roomStatus === RoomStatus.BURIED) {
      throw new ConflictException({
        success: false,
        error: 'ALREADY_SUBMITTED',
        message: '이미 제출된 캡슐입니다',
      });
    }
  }

  /**
   * 방장 권한 확인
   */
  private async validateIsRoomOwner(
    capsule: Capsule,
    userId: string,
  ): Promise<void> {
    if (capsule.userId === userId) {
      return;
    }

    const ownerSlot = await this.slotRepository.findOne({
      where: { capsuleId: capsule.id, slotIndex: 0 },
    });

    if (ownerSlot && ownerSlot.userId === userId) {
      return;
    }

    throw new ForbiddenException({
      success: false,
      error: 'NOT_ROOM_OWNER',
      message: '방장만 최종 제출할 수 있습니다',
    });
  }

  /**
   * 모든 참여자 완료 상태 확인
   */
  private async validateAllParticipantsCompleted(
    capsuleId: string,
    headcount: number,
  ): Promise<{
    allCompleted: boolean;
    incompleteSlots: CapsuleParticipantSlot[];
  }> {
    const slots = await this.slotRepository.find({
      where: { capsuleId },
      relations: ['user'],
      order: { slotIndex: 'ASC' },
    });

    const assignedSlots = slots.filter((s) => s.userId !== null);

    const completedSlots = assignedSlots.filter(
      (s) => s.status === 'COMPLETED',
    );
    const allCompleted =
      assignedSlots.length === headcount && completedSlots.length === headcount;

    return {
      allCompleted,
      incompleteSlots: assignedSlots.filter((s) => s.status !== 'COMPLETED'),
    };
  }

  /**
   * 캡슐 매장 (트랜잭션)
   */
  private async buryCapsuleTransaction(
    capsule: Capsule,
    latitude: number,
    longitude: number,
    headcount: number,
    isAutoSubmitted: boolean,
  ): Promise<SubmitCapsuleResponseDto> {
    return await this.dataSource.transaction(async (manager) => {
      const capsuleRepo = manager.getRepository(Capsule);
      const timeCapsuleRepo = manager.getRepository(TimeCapsule);
      const slotRepo = manager.getRepository(CapsuleParticipantSlot);

      // 1. 모든 참여자 슬롯 데이터 조회
      const slots = await slotRepo.find({
        where: { capsuleId: capsule.id },
        order: { slotIndex: 'ASC' },
      });

      // 2. 슬롯 데이터를 캡슐 필드로 집계
      const textBlocks: { order: number; content: string }[] = [];
      const allMediaIds: string[] = [];
      const mediaTypes: (MediaType | null)[] = [];

      slots.forEach((slot, index) => {
        // 텍스트 메시지 수집
        if (slot.textMessage) {
          textBlocks.push({
            order: index + 1,
            content: slot.textMessage,
          });
        }

        // 이미지 ID 수집
        if (slot.imageIds && slot.imageIds.length > 0) {
          allMediaIds.push(...slot.imageIds);
          slot.imageIds.forEach(() => mediaTypes.push(MediaType.IMAGE));
        }

        // 음악 ID 수집
        if (slot.musicId) {
          allMediaIds.push(slot.musicId);
          mediaTypes.push(MediaType.MUSIC);
        }

        // 비디오 ID 수집
        if (slot.videoId) {
          allMediaIds.push(slot.videoId);
          mediaTypes.push(MediaType.VIDEO);
        }
      });

      // 3. 캡슐 필드 업데이트
      capsule.latitude = latitude;
      capsule.longitude = longitude;

      const timeCapsule =
        capsule.timeCapsule ||
        (await timeCapsuleRepo.findOne({
          where: { capsuleId: capsule.id },
        }));
      if (!timeCapsule) {
        throw new NotFoundException('TIME_CAPSULE_NOT_FOUND');
      }
      timeCapsule.roomStatus = RoomStatus.BURIED;
      timeCapsule.buriedAt = new Date();
      timeCapsule.isAutoSubmitted = isAutoSubmitted;

      // 참여자 데이터 반영
      capsule.textBlocks = textBlocks.length > 0 ? textBlocks : null;
      capsule.mediaItemIds = allMediaIds.length > 0 ? allMediaIds : null;
      capsule.mediaTypes = mediaTypes.length > 0 ? mediaTypes : null;

      // content는 모든 텍스트를 합친 것 (최대 500자)
      if (textBlocks.length > 0) {
        const combinedText = textBlocks.map((tb) => tb.content).join(' ');
        capsule.content = combinedText.substring(0, 500);
      }

      // title이 없으면 기본값 설정
      if (!capsule.title) {
        capsule.title = '타임캡슐';
      }

      await capsuleRepo.save(capsule);
      await timeCapsuleRepo.save(timeCapsule);

      // TODO: 주소 변환 API 연동 (Google Maps Geocoding 등)
      const address = '서울특별시 중구 세종대로 110'; // 임시
      const buriedAt = timeCapsule.buriedAt || new Date();
      const openDate = timeCapsule.openAt || new Date();

      return {
        success: true,
        data: {
          capsule_id: capsule.id,
          status: 'BURIED',
          location: {
            latitude: capsule.latitude,
            longitude: capsule.longitude,
            address,
          },
          buried_at: buriedAt,
          open_date: openDate,
          participants: headcount,
          is_auto_submitted: isAutoSubmitted,
        },
      };
    });
  }

  // ==========================================
  // Public API 메서드
  // ==========================================

  /**
   * 결제 완료된 주문으로 캡슐(대기실) 생성
   */
  async createCapsuleWithStepRoom(orderId: string): Promise<Capsule> {
    return this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(Order, {
        where: { id: orderId },
        relations: ['product', 'user'],
      });

      if (!order) {
        throw new NotFoundException('주문을 찾을 수 없습니다');
      }

      if (order.status !== OrderStatus.PAID) {
        throw new BadRequestException(
          '결제 완료된 주문만 대기실을 생성할 수 있습니다',
        );
      }

      const existing = await manager.findOne(TimeCapsule, {
        where: { orderId: orderId },
        relations: { capsule: true },
      });

      if (existing?.capsule) {
        existing.capsule.timeCapsule = existing;
        return existing.capsule;
      }

      if (!order.product.isActive) {
        throw new BadRequestException('비활성 상품입니다');
      }

      if (order.product.productType !== ProductType.TIME_CAPSULE) {
        throw new BadRequestException(
          '타임캡슐 상품만 대기실을 생성할 수 있습니다',
        );
      }

      if (order.headcount < 1 || order.headcount > 10) {
        throw new BadRequestException('인원수는 1~10명이어야 합니다');
      }

      if (order.timeOption === TimeOption.CUSTOM && !order.customOpenAt) {
        throw new BadRequestException(
          'CUSTOM 옵션은 customOpenAt이 필요합니다',
        );
      }

      // 초대 코드 생성 (최대 5번 재시도)
      let inviteCode = '';
      let attempts = 0;
      const maxAttempts = 5;

      while (attempts < maxAttempts) {
        inviteCode = this.generateInviteCode();
        const exists = await manager.findOne(TimeCapsule, {
          where: { inviteCode: inviteCode },
        });

        if (!exists) break;
        attempts++;
      }

      if (attempts === maxAttempts) {
        throw new InternalServerErrorException('초대 코드 생성 실패');
      }

      const deadline = new Date();
      deadline.setHours(deadline.getHours() + 24);

      const openAt =
        order.customOpenAt || this.calculateOpenDate(order.timeOption);

      const capsule = manager.create(Capsule, {
        userId: order.userId,
        capsuleType: CapsuleType.TIME_CAPSULE,
        title: order.capsuleTitle || 'My Time Capsule',
        content: null,
        mediaUrls: null,
        mediaItemIds: null,
        mediaTypes: null,
        textBlocks: null,
      });

      await manager.save(capsule);
      const timeCapsule = manager.create(TimeCapsule, {
        capsuleId: capsule.id,
        orderId: order.id,
        openAt: openAt,
        isLocked: true,
        inviteCode: inviteCode,
        deadline: deadline,
        roomStatus: RoomStatus.WAITING,
        buriedAt: null,
        isAutoSubmitted: false,
      });
      timeCapsule.order = order;
      await manager.save(timeCapsule);
      capsule.timeCapsule = timeCapsule;

      await this.createParticipantSlotsForStepRoom(
        capsule.id,
        order.userId,
        order.headcount,
        manager,
      );

      return capsule;
    });
  }

  /**
   * 초대 코드로 캡슐(대기실) 조회
   */
  async findCapsuleByInviteCode(
    inviteCode: string,
  ): Promise<StepRoomResponseDto> {
    const timeCapsule = await this.timeCapsuleRepository.findOne({
      where: { inviteCode: inviteCode.toUpperCase() },
      relations: { capsule: true, order: true },
    });

    if (!timeCapsule || !timeCapsule.capsule) {
      throw new NotFoundException('존재하지 않는 초대 코드입니다');
    }
    const capsule = timeCapsule.capsule;

    const slots = await this.slotRepository.find({
      where: { capsuleId: capsule.id },
    });

    const currentParticipants = slots.filter((s) => s.userId !== null).length;
    const isDeadlinePassed =
      timeCapsule.deadline && new Date() > timeCapsule.deadline;
    const maxParticipants = timeCapsule.order?.headcount ?? 0;
    const isFull =
      maxParticipants > 0 && currentParticipants >= maxParticipants;

    return {
      room_id: capsule.id,
      capsule_name: capsule.title,
      open_date: timeCapsule.openAt!,
      deadline: timeCapsule.deadline!,
      participant_count: maxParticipants,
      current_participants: currentParticipants,
      status: isDeadlinePassed
        ? 'EXPIRED'
        : timeCapsule.roomStatus || 'WAITING',
      is_joinable:
        !isDeadlinePassed &&
        !isFull &&
        timeCapsule.roomStatus === RoomStatus.WAITING,
    };
  }

  /**
   * 대기실 상세 조회 (참여자 전용)
   */
  async getStepRoomDetail(
    capsuleId: string,
    userId: string,
    inviteCode?: string,
  ): Promise<StepRoomDetailDto> {
    const capsule = await this.capsuleRepository.findOne({
      where: { id: capsuleId },
      relations: { timeCapsule: true },
    });

    if (!capsule) {
      throw new NotFoundException('대기실을 찾을 수 없습니다');
    }
    if (!capsule.timeCapsule) {
      throw new NotFoundException('대기실을 찾을 수 없습니다');
    }

    const slots = await this.slotRepository.find({
      where: { capsuleId: capsule.id },
      relations: ['user'],
      order: { slotIndex: 'ASC' },
    });

    // 접근 권한 검증: 참여자이거나 올바른 초대 코드를 가진 경우
    const isParticipant = slots.some((s) => s.userId === userId);
    const hasValidInviteCode =
      inviteCode &&
      capsule.timeCapsule.inviteCode &&
      inviteCode.toUpperCase() === capsule.timeCapsule.inviteCode.toUpperCase();

    if (!isParticipant && !hasValidInviteCode) {
      throw new ForbiddenException({
        success: false,
        error: 'UNAUTHORIZED_ACCESS',
        message: '참여자만 조회할 수 있습니다',
      });
    }

    return {
      room_id: capsule.id,
      capsule_name: capsule.title,
      open_date: capsule.timeCapsule.openAt!,
      deadline: capsule.timeCapsule.deadline!,
      status: capsule.timeCapsule.roomStatus || 'WAITING',
      slots: slots.map((slot) => ({
        slot_number: slot.slotIndex + 1,
        user_id: slot.userId,
        is_host: slot.slotIndex === 0,
        status: slot.userId ? 'ACCEPTED' : 'PENDING',
        nickname: slot.user?.nickname || null,
        has_content: slot.status === 'COMPLETED',
      })),
    };
  }

  /**
   * 대기실 참여 (슬롯 배정)
   */
  async joinStepRoom(
    capsuleId: string,
    userId: string,
    inviteCode: string,
  ): Promise<JoinStepRoomResponseDto> {
    return await this.dataSource.transaction(async (manager) => {
      // 1. 캡슐 조회
      const capsule = await manager.findOne(Capsule, {
        where: { id: capsuleId },
        relations: { timeCapsule: { order: true } },
      });

      if (!capsule) {
        throw new NotFoundException({
          success: false,
          error: 'NOT_FOUND',
          message: '대기실을 찾을 수 없습니다',
        });
      }
      if (!capsule.timeCapsule) {
        throw new NotFoundException({
          success: false,
          error: 'NOT_FOUND',
          message: '대기실을 찾을 수 없습니다',
        });
      }

      // 2. 초대 코드 검증
      if (
        !capsule.timeCapsule?.inviteCode ||
        capsule.timeCapsule.inviteCode.toUpperCase() !==
          inviteCode.toUpperCase()
      ) {
        throw new ForbiddenException({
          success: false,
          error: 'INVALID_INVITE_CODE',
          message: '올바르지 않은 초대 코드입니다',
        });
      }

      // 3. 마감시한 확인
      if (
        capsule.timeCapsule?.deadline &&
        new Date() > capsule.timeCapsule.deadline
      ) {
        throw new ForbiddenException({
          success: false,
          error: 'DEADLINE_PASSED',
          message: '참여 마감시한이 지났습니다',
        });
      }

      // 4. 대기실 상태 확인
      if (capsule.timeCapsule?.roomStatus !== RoomStatus.WAITING) {
        throw new ForbiddenException({
          success: false,
          error: 'ROOM_NOT_WAITING',
          message: '현재 참여할 수 없는 상태입니다',
        });
      }

      // 5. 사용자 정보 조회
      const user = await manager.findOne(User, { where: { id: userId } });
      if (!user) {
        throw new NotFoundException({
          success: false,
          error: 'USER_NOT_FOUND',
          message: '사용자를 찾을 수 없습니다',
        });
      }

      // 6. 슬롯 조회
      const slotRepo = manager.getRepository(CapsuleParticipantSlot);
      const slots = await slotRepo.find({
        where: { capsuleId: capsule.id },
        order: { slotIndex: 'ASC' },
      });

      // 7. 이미 참여 중인지 확인
      const existingSlot = slots.find((s) => s.userId === userId);
      if (existingSlot) {
        throw new ConflictException({
          success: false,
          error: 'ALREADY_JOINED',
          message: '이미 참여 중입니다',
          data: {
            slot_number: existingSlot.slotIndex + 1,
          },
        });
      }

      // 8. 빈 슬롯 찾기
      const emptySlot = slots.find((s) => s.userId === null);
      if (!emptySlot) {
        throw new ForbiddenException({
          success: false,
          error: 'SLOTS_FULL',
          message: '정원이 초과되었습니다',
          data: {
            max_participants: capsule.timeCapsule?.order?.headcount ?? 0,
            current_participants: slots.filter((s) => s.userId !== null).length,
          },
        });
      }

      // 9. 슬롯 배정
      emptySlot.userId = userId;
      emptySlot.assignedAt = new Date();
      await slotRepo.save(emptySlot);

      // 10. 응답 반환
      return {
        success: true,
        room_id: capsule.id,
        slot_number: emptySlot.slotIndex + 1,
        nickname: user.nickname || '익명',
        joined_at: emptySlot.assignedAt,
      };
    });
  }

  /**
   * 대기실 설정값 조회
   */
  async getStepRoomSettings(
    capsuleId: string,
  ): Promise<StepRoomSettingsResponseDto> {
    const capsule = await this.capsuleRepository.findOne({
      where: { id: capsuleId },
      relations: { timeCapsule: { order: true } },
    });

    if (!capsule) {
      throw new NotFoundException('대기실을 찾을 수 없습니다');
    }

    if (!capsule.timeCapsule?.order) {
      throw new NotFoundException('주문 정보를 찾을 수 없습니다');
    }

    const order = capsule.timeCapsule.order;

    // photoCount는 이미 '인당 개수'이므로 그대로 사용
    const maxImagesPerPerson = order.photoCount;

    const openDate = capsule.timeCapsule.openAt
      ? capsule.timeCapsule.openAt.toISOString().split('T')[0]
      : '';

    return {
      room_id: capsule.id,
      capsule_name: capsule.title,
      open_date: openDate,
      max_participants: order.headcount,
      max_images_per_person: maxImagesPerPerson,
      has_music: order.addMusic,
      has_video: order.addVideo,
      invite_code: capsule.timeCapsule.inviteCode || '',
    };
  }

  /**
   * 스텝룸 콘텐츠 저장
   */
  async saveMyContent(
    capsuleId: string,
    userId: string,
    saveContentDto: SaveContentDto,
    files: {
      images?: MulterFile[];
      music?: MulterFile[];
      video?: MulterFile[];
    },
  ): Promise<ContentResponseDto> {
    const { capsule, order } =
      await this.timeCapsuleService.ensurePaidCapsuleContext(capsuleId);

    await this.validateStepRoomAccess(
      capsule,
      userId,
      saveContentDto.invite_code,
    );

    await this.validateStepRoomParticipantLimit(capsule, userId);

    this.validateStepRoomMediaSettings(order, files);

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException({
        success: false,
        error: 'USER_NOT_FOUND',
        message: '사용자를 찾을 수 없습니다',
      });
    }

    return await this.saveStepRoomContentTransaction(
      capsule,
      userId,
      user,
      saveContentDto,
      files,
    );
  }

  /**
   * 스텝룸 콘텐츠 부분 수정
   */
  async patchMyContent(
    capsuleId: string,
    userId: string,
    patchContentDto: PatchContentDto,
    files: {
      images?: MulterFile[];
      music?: MulterFile[];
      video?: MulterFile[];
    },
  ): Promise<PatchContentResponseDto> {
    const { capsule, order } =
      await this.timeCapsuleService.ensurePaidCapsuleContext(capsuleId);

    await this.validateStepRoomAccess(capsule, userId);

    this.validateStepRoomMediaSettings(order, files);

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException({
        success: false,
        error: 'USER_NOT_FOUND',
        message: '사용자를 찾을 수 없습니다',
      });
    }

    return await this.patchStepRoomContentTransaction(
      capsule,
      userId,
      user,
      patchContentDto,
      files,
    );
  }

  /**
   * 본인이 작성한 콘텐츠 조회
   */
  async getMyContent(
    capsuleId: string,
    userId: string,
  ): Promise<GetMyContentResponseDto> {
    // 1. 캡슐 존재 확인
    await this.timeCapsuleService.ensurePaidCapsuleContext(capsuleId);

    // 2. 사용자 조회
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException({
        success: false,
        error: 'USER_NOT_FOUND',
        message: '사용자를 찾을 수 없습니다',
      });
    }

    // 3. 본인의 슬롯 조회
    const slot = await this.slotRepository.findOne({
      where: { capsuleId, userId },
      relations: ['music', 'video'],
    });

    // 4. 슬롯이 없으면 참여자가 아님
    if (!slot) {
      throw new ForbiddenException({
        success: false,
        error: 'NOT_PARTICIPANT',
        message: '이 캡슐의 참여자가 아닙니다',
      });
    }

    // 5. 콘텐츠를 작성하지 않았으면 404
    if (slot.status === 'PENDING' && !slot.textMessage) {
      throw new NotFoundException({
        success: false,
        error: 'CONTENT_NOT_FOUND',
        message: '아직 작성하지 않았습니다',
      });
    }

    // 6. 미디어 URL 생성
    const images: Array<{
      media_id: string;
      url: string;
      order: number;
    }> = [];

    if (slot.imageIds && slot.imageIds.length > 0) {
      for (let i = 0; i < slot.imageIds.length; i++) {
        const mediaId = slot.imageIds[i];
        const signedData = await this.mediaService.getSignedUrl(user, mediaId);
        images.push({
          media_id: mediaId,
          url: signedData.url,
          order: i + 1,
        });
      }
    }

    let music: { media_id: string; url: string } | null = null;
    if (slot.musicId && slot.music) {
      const signedData = await this.mediaService.getSignedUrl(
        user,
        slot.musicId,
      );
      music = {
        media_id: slot.musicId,
        url: signedData.url,
      };
    }

    let video: { media_id: string; url: string } | null = null;
    if (slot.videoId && slot.video) {
      const signedData = await this.mediaService.getSignedUrl(
        user,
        slot.videoId,
      );
      video = {
        media_id: slot.videoId,
        url: signedData.url,
      };
    }

    return {
      success: true,
      data: {
        slot_id: slot.id,
        user_id: slot.userId!,
        text_message: slot.textMessage,
        status: slot.status,
        images,
        music,
        video,
        created_at: slot.createdAt,
        updated_at: slot.updatedAt,
      },
    };
  }

  /**
   * 타임캡슐 최종 제출
   */
  async submitCapsule(
    capsuleId: string,
    userId: string,
    latitude: number,
    longitude: number,
  ): Promise<SubmitCapsuleResponseDto> {
    const { capsule, headcount } =
      await this.timeCapsuleService.ensurePaidCapsuleContext(capsuleId);

    this.validateNotAlreadySubmitted(capsule);

    await this.validateIsRoomOwner(capsule, userId);

    const { allCompleted, incompleteSlots } =
      await this.validateAllParticipantsCompleted(capsuleId, headcount);

    if (!allCompleted) {
      const incompleteUsers = incompleteSlots
        .filter((s) => s.user)
        .map((s) => s.user!.nickname);

      throw new BadRequestException({
        success: false,
        error: 'INCOMPLETE_PARTICIPANTS',
        message: '모든 참여자가 저장을 완료해야 제출할 수 있습니다',
        data: {
          completed: headcount - incompleteSlots.length,
          total: headcount,
          incomplete_users:
            incompleteUsers.length > 0 ? incompleteUsers : ['미참여자'],
        },
      });
    }

    return await this.buryCapsuleTransaction(
      capsule,
      latitude,
      longitude,
      headcount,
      false, // 수동 제출
    );
  }
}
