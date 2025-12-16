import { Body, Controller, Post, UseGuards } from '@nestjs/common';
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
}
