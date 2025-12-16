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
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../entities';
import { CapsulesService } from './capsules.service';
import { CreateCapsuleDto } from './dto/create-capsule.dto';
import { GetCapsuleParamDto, GetCapsuleQueryDto } from './dto/get-capsule.dto';

@ApiTags('Capsules')
@ApiBearerAuth('access-token')
@Controller('capsules')
export class CapsulesController {
  constructor(private readonly capsulesService: CapsulesService) {}

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
