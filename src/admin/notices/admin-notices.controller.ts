import {
  Body,
  Controller,
  Delete,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AdminJwtAuthGuard } from '../auth/guards/admin-jwt-auth.guard';
import { CurrentAdmin } from '../auth/decorators/current-admin.decorator';
import { AdminUser } from '../../entities';
import { NoticesService } from '../../notices/notices.service';
import { CreateNoticeDto } from '../../notices/dto/create-notice.dto';
import { UpdateNoticeDto } from '../../notices/dto/update-notice.dto';
import type { MulterFile } from '../../media/types/multer-file.interface';

@ApiTags('Admin - Notices')
@ApiBearerAuth('access-token')
@UseGuards(AdminJwtAuthGuard)
@Controller('admin/notices')
export class AdminNoticesController {
  constructor(private readonly noticesService: NoticesService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('image', {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      storage: memoryStorage(),
      limits: {
        fileSize: 5 * 1024 * 1024, // 최대 5MB
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: '공지사항 작성' })
  create(
    @CurrentAdmin() admin: AdminUser,
    @Body() dto: CreateNoticeDto,
    @UploadedFile() file?: MulterFile,
  ) {
    return this.noticesService.createNotice(admin.id, dto, file);
  }

  @Patch(':id')
  @UseInterceptors(
    FileInterceptor('image', {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      storage: memoryStorage(),
      limits: {
        fileSize: 5 * 1024 * 1024, // 최대 5MB
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: '공지사항 수정' })
  update(
    @CurrentAdmin() admin: AdminUser,
    @Param('id') noticeId: string,
    @Body() dto: UpdateNoticeDto,
    @UploadedFile() file?: MulterFile,
  ) {
    return this.noticesService.updateNotice(admin.id, noticeId, dto, file);
  }

  @Delete(':id')
  @ApiOperation({ summary: '공지사항 삭제' })
  remove(@Param('id') noticeId: string) {
    return this.noticesService.deleteNotice(noticeId);
  }
}
