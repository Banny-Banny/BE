import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiQuery,
} from '@nestjs/swagger';
import { FilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../entities';
import { CapsulesService } from './capsules.service';
import { CreateCapsuleDto } from './dto/create-capsule.dto';
import { GetCapsulesListQueryDto } from './dto/get-capsules-list.dto';
import { GetCapsuleParamDto, GetCapsuleQueryDto } from './dto/get-capsule.dto';
import { GetCapsuleSlotsResponseDto } from './dto/get-capsule-slots.dto';
import { MediaType } from '../common/enums';
import { GetViewersResponseDto } from './dto/get-viewers-response.dto';
import { MulterFile } from '../media/types/multer-file.interface';
import { GetMyEggsQueryDto } from './dto/get-my-eggs-query.dto';
import {
  GetMyPlantedEggsResponseDto,
  GetMyFoundEggsResponseDto,
} from './dto/get-my-eggs-response.dto';
import { GetEggDetailResponseDto } from './dto/get-egg-detail-response.dto';

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
            media_items: [
              {
                media_id: 'uuid',
                type: 'IMAGE',
                object_key: 'media/user-id/IMAGE/uuid.jpg',
              },
            ],
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
  @UseInterceptors(FilesInterceptor('media_files', 10))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: '이스터에그(캡슐) 생성',
    description:
      '제목(100자)/텍스트 블록(각 500자)/미디어 파일(최대 10개), view_limit, open_at, product_id를 포함해 캡슐을 생성합니다. 이스터에그 생성 시 위도(latitude)와 경도(longitude)는 필수입니다. 슬롯이 없으면 409. 미디어 파일은 form-data로 직접 업로드합니다.',
  })
  @ApiResponse({ status: 201, description: '생성 성공' })
  @ApiResponse({ status: 400, description: '검증 실패' })
  @ApiResponse({ status: 401, description: '인증 실패' })
  @ApiResponse({ status: 404, description: 'product_id 미존재' })
  @ApiResponse({ status: 409, description: '슬롯 부족' })
  async create(
    @CurrentUser() user: User,
    @Body() dto: CreateCapsuleDto,
    @UploadedFiles() files?: MulterFile[],
  ) {
    const capsule = await this.capsulesService.create(user, dto, files);
    const mediaItems = extractMediaItems(
      capsule as { mediaItems?: MediaItemResponse[] },
    );
    return {
      id: capsule.id,
      title: capsule.title,
      open_at: capsule.openAt,
      is_locked: capsule.isLocked,
      view_limit: capsule.viewLimit,
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

  @Get('my-eggs')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: '내 이스터에그 목록 조회 (심은 알 / 발견한 알)',
    description:
      'type 파라미터로 심은 알(PLANTED) 또는 발견한 알(FOUND)을 조회합니다. 발견한 알은 sort 파라미터로 정렬 가능합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '목록 조회 성공 (심은 알)',
    type: GetMyPlantedEggsResponseDto,
    schema: {
      example: {
        summary: {
          totalPlantedCount: 5,
          activeCount: 3,
        },
        data: {
          activeEggs: [
            {
              eggId: '550e8400-e29b-41d4-a716-446655440000',
              title: '응원의 메시지',
              content: '너는 할 수 있어! 항상 응원할게 파이팅!!',
              viewCount: 1,
              location: '37.566535, 126.977969',
              latitude: 37.566535,
              longitude: 126.977969,
              hasImage: true,
              hasAudio: true,
              createdDate: '2024-12-01T00:00:00.000Z',
              status: 'ACTIVE',
            },
          ],
          expiredEggs: [
            {
              eggId: '550e8400-e29b-41d4-a716-446655440001',
              title: '추억의 순간',
              content: '이 노래 들으면서 이 사진 보면 그날 생각날 거야!',
              viewCount: 3,
              location: '37.395126, 126.640755',
              latitude: 37.395126,
              longitude: 126.640755,
              hasImage: true,
              hasAudio: true,
              createdDate: '2024-12-01T00:00:00.000Z',
              status: 'EXPIRED',
            },
          ],
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: '목록 조회 성공 (발견한 알)',
    type: GetMyFoundEggsResponseDto,
    schema: {
      example: {
        summary: {
          totalFoundCount: 5,
        },
        data: [
          {
            eggId: '550e8400-e29b-41d4-a716-446655440002',
            title: '어느 날의 선물',
            content: '길 가다 발견한 작은 행운...',
            viewCount: 10,
            location: '35.179554, 129.075638',
            latitude: 35.179554,
            longitude: 129.075638,
            hasImage: false,
            hasAudio: true,
            foundDate: '2025-01-05T14:30:00.000Z',
            createdDate: '2024-12-25T04:23:00.000Z',
          },
        ],
      },
    },
  })
  @ApiResponse({ status: 400, description: '잘못된 type 파라미터' })
  @ApiResponse({ status: 401, description: '인증 실패' })
  @ApiQuery({
    name: 'type',
    required: true,
    enum: ['PLANTED', 'FOUND'],
    description: 'PLANTED: 심은 알, FOUND: 발견한 알',
  })
  @ApiQuery({
    name: 'sort',
    required: false,
    enum: ['LATEST', 'OLDEST'],
    description: '정렬 순서 (type=FOUND일 때만 사용)',
  })
  async getMyEggs(
    @CurrentUser() user: User,
    @Query() query: GetMyEggsQueryDto,
  ): Promise<GetMyPlantedEggsResponseDto | GetMyFoundEggsResponseDto> {
    return this.capsulesService.getMyEggs(user, query.type, query.sort);
  }

  @Get(':id/detail')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: '알 상세 정보 조회 (신규 형식)',
    description:
      '특정 알의 ID를 기반으로 상세 콘텐츠(메시지, 사진, 음악, 위치 등)를 조회합니다. 본인이 심은 알 또는 발견한 알을 구분하여 반환합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '조회 성공',
    type: GetEggDetailResponseDto,
    schema: {
      example: {
        eggId: '550e8400-e29b-41d4-a716-446655440000',
        type: 'FOUND',
        isMine: false,
        title: '좋은 하루',
        message: '오늘도 웃으면서 보내! 넌 최고야',
        imageMediaId: '550e8400-e29b-41d4-a716-446655440001',
        imageObjectKey: 'media/user-id/IMAGE/uuid.jpg',
        audioMediaId: '550e8400-e29b-41d4-a716-446655440002',
        audioObjectKey: 'media/user-id/AUDIO/uuid.mp3',
        videoMediaId: null,
        videoObjectKey: null,
        location: {
          address: '37.566535, 126.977969',
          latitude: 37.566535,
          longitude: 126.977969,
        },
        author: {
          id: '550e8400-e29b-41d4-a716-446655440003',
          nickname: '김철수',
          profileImg: 'https://example.com/profile.jpg',
        },
        createdAt: '2024-11-10T00:00:00.000Z',
        foundAt: '2024-12-01T14:30:00.000Z',
        expiredAt: null,
        discoveredCount: 3,
        viewers: [
          {
            id: '550e8400-e29b-41d4-a716-446655440004',
            nickname: '이영희',
            profileImg: 'https://example.com/profile2.jpg',
            viewedAt: '2024-12-01T14:30:00.000Z',
          },
        ],
      },
    },
  })
  @ApiResponse({ status: 400, description: '잘못된 id 또는 좌표' })
  @ApiResponse({ status: 401, description: '인증 실패' })
  @ApiResponse({ status: 403, description: '위치 미도달 또는 친구 아님' })
  @ApiResponse({ status: 404, description: '캡슐 미존재/삭제' })
  async getEggDetail(
    @CurrentUser() user: User,
    @Param() params: GetCapsuleParamDto,
    @Query() query: GetCapsuleQueryDto,
  ): Promise<GetEggDetailResponseDto> {
    return this.capsulesService.getEggDetail(user, params.id, query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: '이스터에그(캡슐) 조회',
    description:
      '본인 캡슐은 언제든지 조회 가능. 타인 캡슐은 300m 반경 도달 + 친구(connected)일 때만 열람 가능. lat/lng 쿼리로 위치 검증. 작성자 정보, 조회자 목록, 생성일시를 포함하여 반환합니다.',
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
        media_items: [
          {
            media_id: 'uuid',
            type: 'IMAGE',
            object_key: 'media/user-id/IMAGE/uuid.jpg',
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

  @Post(':id/viewers')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: '이스터에그 발견 기록',
    description:
      '사용자가 이스터에그를 발견했을 때 조회 로그를 기록합니다. 중복 조회는 자동으로 처리되며, 첫 조회인 경우에만 view_count가 증가합니다.',
  })
  @ApiResponse({
    status: 201,
    description: '발견 기록 성공',
    schema: {
      example: {
        success: true,
        message: '이스터에그를 발견했습니다!',
        is_first_view: true,
      },
    },
  })
  @ApiResponse({ status: 401, description: '인증 실패' })
  @ApiResponse({ status: 404, description: '캡슐 미존재/삭제' })
  async recordViewer(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) capsuleId: string,
  ) {
    return this.capsulesService.recordCapsuleViewer(user, capsuleId);
  }

  @Get(':id/viewers')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: '이스터에그 발견자 목록 조회',
    description:
      '특정 캡슐을 발견한 사용자 목록을 조회합니다. 조회 시각 오름차순으로 정렬되어 반환됩니다.',
  })
  @ApiResponse({
    status: 200,
    description: '발견자 목록 조회 성공',
    type: GetViewersResponseDto,
    schema: {
      example: {
        capsule_id: '550e8400-e29b-41d4-a716-446655440000',
        total_viewers: 3,
        view_limit: 10,
        viewers: [
          {
            id: '550e8400-e29b-41d4-a716-446655440001',
            nickname: '김철수',
            profile_img: 'https://example.com/profile1.jpg',
            viewed_at: '2025-01-02T10:30:00.000Z',
          },
          {
            id: '550e8400-e29b-41d4-a716-446655440002',
            nickname: '이영희',
            profile_img: 'https://example.com/profile2.jpg',
            viewed_at: '2025-01-02T11:15:00.000Z',
          },
          {
            id: '550e8400-e29b-41d4-a716-446655440003',
            nickname: '박민수',
            profile_img: null,
            viewed_at: '2025-01-02T12:00:00.000Z',
          },
        ],
      },
    },
  })
  @ApiResponse({ status: 401, description: '인증 실패' })
  @ApiResponse({ status: 404, description: '캡슐 미존재/삭제' })
  async getViewers(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) capsuleId: string,
  ): Promise<GetViewersResponseDto> {
    return this.capsulesService.getCapsuleViewers(user, capsuleId);
  }
}
