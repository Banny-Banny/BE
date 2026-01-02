import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../entities';
import { CapsulesService } from './capsules.service';
import { CreateCapsuleDto } from './dto/create-capsule.dto';
import { GetCapsulesListQueryDto } from './dto/get-capsules-list.dto';
import { GetCapsuleParamDto, GetCapsuleQueryDto } from './dto/get-capsule.dto';
import { GetCapsuleSlotsResponseDto } from './dto/get-capsule-slots.dto';
import { MediaType } from '../common/enums';
import {
  StepRoomResponseDto,
  StepRoomDetailDto,
} from './dto/step-room-response.dto';
import { StepRoomSettingsResponseDto } from './dto/step-room-settings.dto';

type MediaItemResponse = {
  media_id: string | null;
  type: MediaType | null;
  object_key: string | null;
};

function extractMediaItems(
  capsule: { mediaItems?: MediaItemResponse[] } | undefined,
): MediaItemResponse[] {
  if (!capsule?.mediaItems) return [];
  return Array.isArray(capsule.mediaItems) ? capsule.mediaItems : [];
}

@ApiTags('Capsules')
@ApiBearerAuth('access-token')
@Controller('capsules')
export class CapsulesController {
  constructor(private readonly capsulesService: CapsulesService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: '캡슐(이스터에그/타임캡슐) 위치 기반 목록',
    description:
      'lat/lng 필수. radius_m(기본 300m), 친구/반경/소진 필터로 접근 가능한 캡슐 목록을 반환합니다. type 필드로 EASTER_EGG와 TIME_CAPSULE을 구분합니다.',
  })
  @ApiResponse({ status: 200, description: '목록 조회 성공' })
  @ApiResponse({ status: 400, description: '좌표/반경/limit 검증 실패' })
  @ApiResponse({ status: 401, description: '인증 실패' })
  @ApiResponse({ status: 403, description: '시스템 정책 차단' })
  @ApiResponse({
    status: 200,
    description: '목록 조회 성공',
    schema: {
      example: {
        items: [
          {
            id: 'uuid',
            title: 'capsule',
            content: null,
            open_at: '2025-12-31T00:00:00.000Z',
            is_locked: true,
            view_limit: 1,
            view_count: 0,
            can_open: false,
            latitude: 37.12,
            longitude: 127.12,
            distance_m: 120.5,
            type: 'EASTER_EGG',
            is_mine: false,
            media_types: ['IMAGE'],
            media_urls: ['https://...'],
            product: {
              id: 'uuid|null',
              product_type: 'EASTER_EGG',
              max_media_count: 3,
              media_types: ['IMAGE'],
            },
          },
        ],
        page_info: { next_cursor: '...' },
      },
    },
  })
  @ApiQuery({
    name: 'lat',
    required: true,
    type: Number,
    description: '사용자 현재 위도',
  })
  @ApiQuery({
    name: 'lng',
    required: true,
    type: Number,
    description: '사용자 현재 경도',
  })
  @ApiQuery({
    name: 'radius_m',
    required: false,
    type: Number,
    description: '조회 반경(m). 기본 300, 최소 10, 최대 5000',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: '페이지 크기. 기본 50, 최대 200',
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    type: String,
    description: '다음 페이지 커서 (base64)',
  })
  @ApiQuery({
    name: 'include_locationless',
    required: false,
    type: Boolean,
    description: '좌표 없는 캡슐도 포함 여부 (기본 false)',
  })
  @ApiQuery({
    name: 'include_consumed',
    required: false,
    type: Boolean,
    description: 'view_limit 소진 캡슐도 can_open=false로 포함 (기본 false)',
  })
  async findNearby(
    @CurrentUser() user: User,
    @Query() query: GetCapsulesListQueryDto,
  ) {
    return this.capsulesService.findNearby(user, query);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: '이스터에그(캡슐) 생성',
    description:
      '제목(100자)/텍스트 블록(각 500자)/미디어(media_ids 또는 media_urls/types), view_limit, open_at, product_id를 포함해 캡슐을 생성합니다. 이스터에그 생성 시 위도(latitude)와 경도(longitude)는 필수입니다. 슬롯이 없으면 409.',
  })
  @ApiResponse({ status: 201, description: '생성 성공' })
  @ApiResponse({ status: 400, description: '검증 실패' })
  @ApiResponse({ status: 401, description: '인증 실패' })
  @ApiResponse({ status: 404, description: 'product_id 미존재' })
  @ApiResponse({ status: 409, description: '슬롯 부족' })
  async create(@CurrentUser() user: User, @Body() dto: CreateCapsuleDto) {
    const capsule = await this.capsulesService.create(user, dto);
    const mediaItems = extractMediaItems(
      capsule as { mediaItems?: MediaItemResponse[] },
    );
    return {
      id: capsule.id,
      title: capsule.title,
      open_at: capsule.openAt,
      is_locked: capsule.isLocked,
      view_limit: capsule.viewLimit,
      media_types: capsule.mediaTypes,
      media_urls: capsule.mediaUrls,
      media_items: mediaItems,
      text_blocks: capsule.textBlocks,
    };
  }

  @Get('slots')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: '남은 캡슐 슬롯 조회',
    description: '현재 사용자가 생성 가능한 남은 캡슐 개수를 조회합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '슬롯 정보 조회 성공',
    type: GetCapsuleSlotsResponseDto,
  })
  @ApiResponse({ status: 401, description: '인증 실패' })
  @ApiResponse({ status: 404, description: '사용자를 찾을 수 없음' })
  async getCapsuleSlots(
    @CurrentUser() user: User,
  ): Promise<GetCapsuleSlotsResponseDto> {
    return this.capsulesService.getCapsuleSlots(user.id);
  }

  @Post('slots/reset')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: '이스터에그 슬롯 초기화',
    description:
      '현재 사용자가 작성한 모든 이스터에그를 삭제하고, 슬롯을 기본값(3)으로 초기화합니다. 관련된 모든 데이터(엔트리, 슬롯, 조회 로그)가 함께 삭제됩니다.',
  })
  @ApiResponse({
    status: 200,
    description: '초기화 성공',
    schema: {
      example: {
        egg_slots: 3,
      },
    },
  })
  @ApiResponse({ status: 401, description: '인증 실패' })
  async resetSlots(@CurrentUser() user: User) {
    const eggSlots = await this.capsulesService.resetEggSlots(user);
    return { egg_slots: eggSlots };
  }

  @Get('step-rooms')
  @ApiOperation({ summary: '초대 코드로 대기실 조회' })
  @ApiQuery({
    name: 'invite_code',
    required: true,
    description: '초대 코드 (6자리)',
  })
  @ApiResponse({
    status: 200,
    description: '대기실 정보 조회 성공',
    type: StepRoomResponseDto,
  })
  @ApiResponse({ status: 404, description: '존재하지 않는 초대 코드' })
  async getStepRoomByInviteCode(
    @Query('invite_code') inviteCode: string,
  ): Promise<StepRoomResponseDto> {
    return this.capsulesService.findCapsuleByInviteCode(inviteCode);
  }

  @Get('step-rooms/:capsuleId/settings')
  @ApiOperation({
    summary: '대기실 설정값 조회',
    description:
      '방장이 인포에서 설정한 값 조회. 프론트엔드에서 업로드 UI 제어에 사용',
  })
  @ApiResponse({
    status: 200,
    description: '설정값 조회 성공',
    type: StepRoomSettingsResponseDto,
  })
  @ApiResponse({ status: 404, description: '대기실을 찾을 수 없음' })
  async getStepRoomSettings(
    @Param('capsuleId') capsuleId: string,
  ): Promise<StepRoomSettingsResponseDto> {
    return this.capsulesService.getStepRoomSettings(capsuleId);
  }

  @Get('step-rooms/:capsuleId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '대기실 상세 조회 (참여자 전용)' })
  @ApiResponse({
    status: 200,
    description: '대기실 상세 정보 조회 성공',
    type: StepRoomDetailDto,
  })
  @ApiResponse({ status: 403, description: '참여자만 조회 가능' })
  @ApiResponse({ status: 404, description: '대기실을 찾을 수 없음' })
  async getStepRoomDetail(
    @Param('capsuleId') capsuleId: string,
    @CurrentUser() user: User,
  ): Promise<StepRoomDetailDto> {
    return this.capsulesService.getStepRoomDetail(capsuleId, user.id);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: '이스터에그(캡슐) 조회',
    description:
      '위치 도달 + 친구(connected)일 때만 열람 가능. lat/lng 쿼리로 위치 검증. 작성자 정보, 조회자 목록, 생성일시를 포함하여 반환합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '조회 성공',
    schema: {
      example: {
        id: 'uuid',
        title: 'capsule',
        content: 'content',
        open_at: '2025-12-31T00:00:00.000Z',
        is_locked: true,
        view_limit: 1,
        view_count: 1,
        media_types: ['IMAGE'],
        media_urls: ['https://...'],
        media_items: [
          {
            media_id: 'uuid',
            type: 'IMAGE',
            object_key: 'https://...',
          },
        ],
        product: {
          id: 'uuid',
          product_type: 'EASTER_EGG',
          max_media_count: 3,
        },
        latitude: 37.5665,
        longitude: 126.978,
        text_blocks: [{ order: 0, content: 'text' }],
        author: {
          id: 'uuid',
          nickname: 'author',
          profile_img: 'https://...',
        },
        viewers: [
          {
            id: 'uuid',
            nickname: 'viewer',
            profile_img: 'https://...',
            viewed_at: '2025-01-01T00:00:00.000Z',
          },
        ],
        created_at: '2025-01-01T00:00:00.000Z',
      },
    },
  })
  @ApiResponse({ status: 400, description: '잘못된 id 또는 좌표' })
  @ApiResponse({ status: 401, description: '인증 실패' })
  @ApiResponse({ status: 403, description: '위치 미도달 또는 친구 아님' })
  @ApiResponse({ status: 404, description: '캡슐 미존재/삭제' })
  async findOne(
    @CurrentUser() user: User,
    @Param() params: GetCapsuleParamDto,
    @Query() query: GetCapsuleQueryDto,
  ) {
    const capsule = await this.capsulesService.findOne(user, params.id, query);

    return {
      id: capsule.id,
      title: capsule.title,
      content: capsule.content,
      open_at: capsule.open_at,
      is_locked: capsule.is_locked,
      view_limit: capsule.view_limit,
      view_count: capsule.view_count,
      media_types: capsule.media_types,
      media_urls: capsule.media_urls,
      media_items: capsule.media_items,
      product: capsule.product
        ? {
            id: capsule.product.id,
            product_type: capsule.product.productType,
            max_media_count: capsule.product.maxMediaCount,
          }
        : null,
      latitude: capsule.latitude,
      longitude: capsule.longitude,
      text_blocks: capsule.text_blocks,
      author: capsule.author,
      viewers: capsule.viewers,
      created_at: capsule.created_at,
    };
  }
}
