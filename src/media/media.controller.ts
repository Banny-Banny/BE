import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../entities';
import { MediaService } from './media.service';
import { PresignMediaDto } from './dto/presign-media.dto';
import { CompleteMediaDto } from './dto/complete-media.dto';
import { MediaType } from '../common/enums';
import { MulterFile } from './types/multer-file.interface';

@ApiTags('Media')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('presign')
  async presign(@CurrentUser() user: User, @Body() dto: PresignMediaDto) {
    return this.mediaService.presign(user, dto);
  }

  @Post('complete')
  async complete(@CurrentUser() user: User, @Body() dto: CompleteMediaDto) {
    return this.mediaService.complete(user, dto);
  }

  @Get(':id/url')
  async signedUrl(@CurrentUser() user: User, @Param('id') id: string) {
    return this.mediaService.getSignedUrl(user, id);
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      storage: memoryStorage(),
      limits: {
        fileSize: 200 * 1024 * 1024, // 최대 200MB
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: '미디어 파일 직접 업로드',
    description:
      'multipart/form-data로 파일을 직접 업로드하여 S3에 저장합니다. presign 방식 대신 권장되는 업로드 방법입니다.',
  })
  @ApiResponse({
    status: 201,
    description: '업로드 성공',
    schema: {
      example: {
        media_id: '550e8400-e29b-41d4-a716-446655440000',
        object_key: 'media/user-id/IMAGE/uuid.jpg',
        type: 'IMAGE',
        size: 1024000,
        content_type: 'image/jpeg',
      },
    },
  })
  @ApiResponse({ status: 400, description: '파일 검증 실패' })
  @ApiResponse({ status: 401, description: '인증 실패' })
  async upload(
    @CurrentUser() user: User,
    @UploadedFile() file: MulterFile | undefined,
    @Body('type') type?: string,
  ) {
    if (!file) {
      throw new BadRequestException('FILE_REQUIRED');
    }

    // type 파라미터가 없으면 content-type으로 자동 감지
    let mediaType: MediaType;
    if (type) {
      if (!Object.values(MediaType).includes(type as MediaType)) {
        throw new BadRequestException('INVALID_MEDIA_TYPE');
      }
      mediaType = type as MediaType;
    } else {
      // Content-Type으로 자동 감지
      if (file.mimetype.startsWith('image/')) {
        mediaType = MediaType.IMAGE;
      } else if (file.mimetype.startsWith('video/')) {
        mediaType = MediaType.VIDEO;
      } else if (file.mimetype.startsWith('audio/')) {
        mediaType = MediaType.AUDIO;
      } else {
        throw new BadRequestException('UNSUPPORTED_FILE_TYPE');
      }
    }

    const media = await this.mediaService.uploadMulterFile(
      user.id,
      file,
      mediaType,
    );

    return {
      media_id: media.id,
      object_key: media.objectKey,
      type: media.type,
      size: media.size,
      content_type: media.contentType,
    };
  }
}
