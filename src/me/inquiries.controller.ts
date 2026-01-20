import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../entities';
import { PaginationQueryDto } from './dto/pagination.dto';
import { InquiriesService } from './inquiries.service';
import { PaginatedUserInquiryResponseDto } from './dto/user-inquiry-list-response.dto';
import { UserInquiryDetailResponseDto } from './dto/user-inquiry-detail-response.dto';

@ApiTags('Me (문의)')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('me/inquiries')
export class InquiriesController {
  constructor(private readonly inquiriesService: InquiriesService) {}

  @Get()
  @ApiOperation({ summary: '내 문의(채팅방) 목록 조회' })
  @ApiResponse({
    status: 200,
    description: '문의 목록 조회 성공',
    type: PaginatedUserInquiryResponseDto,
  })
  @ApiResponse({ status: 401, description: '인증되지 않은 사용자' })
  async list(
    @CurrentUser() user: User,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedUserInquiryResponseDto> {
    return this.inquiriesService.listInquiries(user.id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: '내 문의 상세(메시지) 조회' })
  @ApiResponse({
    status: 200,
    description: '문의 상세 조회 성공',
    type: UserInquiryDetailResponseDto,
  })
  @ApiResponse({ status: 401, description: '인증되지 않은 사용자' })
  @ApiResponse({ status: 404, description: '문의방을 찾을 수 없음' })
  async detail(
    @CurrentUser() user: User,
    @Param('id') inquiryId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<UserInquiryDetailResponseDto> {
    return this.inquiriesService.getInquiryDetail(user.id, inquiryId, query);
  }
}
