import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../entities';
import { MediaService } from './media.service';
import { PresignMediaDto } from './dto/presign-media.dto';
import { CompleteMediaDto } from './dto/complete-media.dto';

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
}

