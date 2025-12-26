import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../entities';
import { CapsulesService } from './capsules.service';
import { GetCapsuleParamDto } from './dto/get-capsule.dto';
import { CreateCapsuleEntryDto } from './dto/create-capsule-entry.dto';

@ApiTags('Capsules (Time Capsule)')
@ApiBearerAuth('access-token')
@Controller('capsules')
export class CapsuleEntriesController {
  constructor(private readonly capsulesService: CapsulesService) {}

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: '타임캡슐 조회 (슬롯/작성자/글/미디어 포함)',
    description:
      '결제 완료된 캡슐만 조회 가능. headcount만큼 슬롯을 반환하며 각 슬롯의 작성자/작성 여부/콘텐츠/미디어 메타를 제공합니다.',
  })
  @ApiResponse({ status: 200, description: '조회 성공' })
  @ApiResponse({ status: 403, description: '권한 없음 또는 미결제' })
  @ApiResponse({ status: 404, description: '캡슐 미존재' })
  async getCapsuleWithSlots(
    @CurrentUser() user: User,
    @Param() params: GetCapsuleParamDto,
  ) {
    return this.capsulesService.getCapsuleWithSlots(user, params.id);
  }

  @Post(':id/entries')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: '타임캡슐 글 작성 (슬롯 1회 작성)',
    description:
      '사용자는 자신이 배정된 슬롯(또는 미배정 슬롯)을 점유하여 한 번만 글/미디어를 작성할 수 있습니다. 미디어는 presign 완료된 media_id로 첨부합니다.',
  })
  @ApiResponse({ status: 201, description: '작성 성공' })
  @ApiResponse({ status: 400, description: '검증 실패' })
  @ApiResponse({ status: 403, description: '권한 없음/다른 사용자 슬롯' })
  @ApiResponse({ status: 404, description: '캡슐 미존재' })
  @ApiResponse({ status: 409, description: '이미 작성됨 또는 슬롯 가득 참' })
  async createCapsuleEntry(
    @CurrentUser() user: User,
    @Param() params: GetCapsuleParamDto,
    @Body() dto: CreateCapsuleEntryDto,
  ) {
    return this.capsulesService.createCapsuleEntry(user, params.id, dto);
  }
}

