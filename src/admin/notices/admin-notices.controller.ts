import {
  Body,
  Controller,
  Delete,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminJwtAuthGuard } from '../auth/guards/admin-jwt-auth.guard';
import { NoticesService } from '../../notices/notices.service';
import { CreateNoticeDto } from '../../notices/dto/create-notice.dto';
import { UpdateNoticeDto } from '../../notices/dto/update-notice.dto';

@ApiTags('Admin - Notices')
@ApiBearerAuth('access-token')
@UseGuards(AdminJwtAuthGuard)
@Controller('admin/notices')
export class AdminNoticesController {
  constructor(private readonly noticesService: NoticesService) {}

  @Post()
  @ApiOperation({ summary: '공지사항 작성' })
  create(@Body() dto: CreateNoticeDto) {
    return this.noticesService.createNotice(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: '공지사항 수정' })
  update(@Param('id') noticeId: string, @Body() dto: UpdateNoticeDto) {
    return this.noticesService.updateNotice(noticeId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '공지사항 삭제' })
  remove(@Param('id') noticeId: string) {
    return this.noticesService.deleteNotice(noticeId);
  }
}
