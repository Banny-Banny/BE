import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { NoticesService } from './notices.service';
import { NoticeListQueryDto } from './dto/notice-list-query.dto';

@ApiTags('Notices')
@Controller('notices')
export class NoticesController {
  constructor(private readonly noticesService: NoticesService) {}

  @Get()
  @ApiOperation({ summary: '공지사항 리스트 조회' })
  list(@Query() query: NoticeListQueryDto) {
    return this.noticesService.listNotices(query);
  }

  @Get(':id')
  @ApiOperation({ summary: '공지사항 상세 조회' })
  detail(@Param('id') noticeId: string) {
    return this.noticesService.getNoticeDetail(noticeId);
  }
}
