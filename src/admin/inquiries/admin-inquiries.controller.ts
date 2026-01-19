import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminJwtAuthGuard } from '../auth/guards/admin-jwt-auth.guard';
import { AdminInquiriesService } from './admin-inquiries.service';
import { AdminInquiryListQueryDto } from './dto/admin-inquiry-list-query.dto';
import { AdminInquiryHistoryQueryDto } from './dto/admin-inquiry-history-query.dto';
import { AdminInquiryStatusDto } from './dto/admin-inquiry-status.dto';
import { AdminInquiryMessageUpdateDto } from './dto/admin-inquiry-message-update.dto';

@ApiTags('Admin - Inquiries')
@ApiBearerAuth('access-token')
@UseGuards(AdminJwtAuthGuard)
@Controller('admin/inquiries')
export class AdminInquiriesController {
  constructor(private readonly adminInquiriesService: AdminInquiriesService) {}

  @Get()
  @ApiOperation({ summary: '문의(채팅방) 리스트 조회' })
  list(@Query() query: AdminInquiryListQueryDto) {
    return this.adminInquiriesService.listInquiries(query);
  }

  @Get(':id')
  @ApiOperation({ summary: '문의 상세(이력) 조회' })
  detail(
    @Param('id') inquiryId: string,
    @Query() query: AdminInquiryHistoryQueryDto,
  ) {
    return this.adminInquiriesService.getInquiryDetail(inquiryId, query);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: '문의 상태 변경' })
  updateStatus(
    @Param('id') inquiryId: string,
    @Body() dto: AdminInquiryStatusDto,
  ) {
    return this.adminInquiriesService.updateStatus(inquiryId, dto.status);
  }

  @Delete(':id')
  @ApiOperation({ summary: '문의방 삭제' })
  deleteInquiry(@Param('id') inquiryId: string) {
    return this.adminInquiriesService.deleteInquiry(inquiryId);
  }

  @Delete(':id/messages/:messageId')
  @ApiOperation({ summary: '문의 메시지 삭제' })
  deleteMessage(
    @Param('id') inquiryId: string,
    @Param('messageId') messageId: string,
  ) {
    return this.adminInquiriesService.deleteMessage(inquiryId, messageId);
  }

  @Put(':id/messages/:messageId')
  @ApiOperation({ summary: '문의 메시지 수정' })
  updateMessage(
    @Param('id') inquiryId: string,
    @Param('messageId') messageId: string,
    @Body() dto: AdminInquiryMessageUpdateDto,
  ) {
    return this.adminInquiriesService.updateMessage(
      inquiryId,
      messageId,
      dto.content,
    );
  }
}
