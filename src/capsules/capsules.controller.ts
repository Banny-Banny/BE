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

@ApiTags('Capsules')
@ApiBearerAuth('access-token')
@Controller('capsule')
export class CapsulesController {
  constructor(private readonly capsulesService: CapsulesService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: '이스터에그(캡슐) 위치 기반 목록',
    description:
      'lat/lng 필수. radius_m(기본 300m), 친구/반경/소진 필터로 접근 가능한 캡슐 목록을 반환합니다.',
  })
  @ApiResponse({ status: 200, description: '목록 조회 성공' })
  @ApiResponse({ status: 400, description: '좌표/반경/limit 검증 실패' })
  @ApiResponse({ status: 401, description: '인증 실패' })
  @ApiResponse({ status: 403, description: '시스템 정책 차단' })
  @ApiOperation({
    summary: '이스터에그(캡슐) 위치 기반 목록',
    description:
      'lat/lng 필수. radius_m(기본 300m), 친구/반경/소진 필터로 접근 가능한 캡슐 목록을 반환합니다.',
  })
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
      '제목/내용(500자), 최대 3개 미디어, view_limit, open_at, product_id를 포함해 캡슐을 생성합니다. 슬롯이 없으면 409.',
  })
  @ApiResponse({ status: 201, description: '생성 성공' })
  @ApiResponse({ status: 400, description: '검증 실패' })
  @ApiResponse({ status: 401, description: '인증 실패' })
  @ApiResponse({ status: 404, description: 'product_id 미존재' })
  @ApiResponse({ status: 409, description: '슬롯 부족' })
  async create(@CurrentUser() user: User, @Body() dto: CreateCapsuleDto) {
    const capsule = await this.capsulesService.create(user, dto);
    return {
      id: capsule.id,
      title: capsule.title,
      open_at: capsule.openAt,
      is_locked: capsule.isLocked,
      view_limit: capsule.viewLimit,
      media_types: capsule.mediaTypes,
      media_urls: capsule.mediaUrls,
    };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: '이스터에그(캡슐) 조회',
    description:
      '위치 도달 + 친구(connected)일 때만 열람 가능. lat/lng 쿼리로 위치 검증.',
  })
  @ApiResponse({ status: 200, description: '조회 성공' })
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
      open_at: capsule.openAt,
      is_locked: capsule.isLocked,
      view_limit: capsule.viewLimit,
      view_count: capsule.viewCount,
      media_types: capsule.mediaTypes,
      media_urls: capsule.mediaUrls,
      product: capsule.product
        ? {
            id: capsule.product.id,
            product_type: capsule.product.productType,
            max_media_count: capsule.product.maxMediaCount,
          }
        : null,
      latitude: capsule.latitude,
      longitude: capsule.longitude,
    };
  }
}
