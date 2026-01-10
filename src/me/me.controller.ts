import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiConsumes,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../entities';
import { MeService } from './me.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { ProfileResponseDto } from './dto/profile-response.dto';
import { PaginationQueryDto } from './dto/pagination.dto';
import { PaginatedCapsuleResponseDto } from './dto/capsule-list-response.dto';
import { MulterFile } from '../media/types/multer-file.interface';

/**
 * 마이페이지 컨트롤러
 * 프로필 조회 및 수정, 알림 설정 관리
 */
@ApiTags('Me (마이페이지)')
@ApiBearerAuth()
@Controller('me')
@UseGuards(JwtAuthGuard)
export class MeController {
  constructor(private readonly meService: MeService) {}

  /**
   * 내 프로필 조회
   * GET /api/me
   */
  @Get()
  @ApiOperation({
    summary: '내 프로필 조회',
    description: '로그인한 사용자의 프로필 정보를 조회합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '프로필 조회 성공',
    type: ProfileResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: '인증되지 않은 사용자',
  })
  @ApiResponse({
    status: 404,
    description: '사용자를 찾을 수 없음',
  })
  async getMyProfile(@CurrentUser() user: User): Promise<ProfileResponseDto> {
    return this.meService.getMyProfile(user.id);
  }

  /**
   * 프로필 수정
   * POST /api/me/update
   */
  @Post('update')
  @ApiOperation({
    summary: '프로필 수정',
    description: '닉네임, 이메일을 수정합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '프로필 수정 성공',
    type: ProfileResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: '잘못된 요청 데이터',
  })
  @ApiResponse({
    status: 401,
    description: '인증되지 않은 사용자',
  })
  @ApiResponse({
    status: 409,
    description: '중복된 닉네임',
  })
  async updateProfile(
    @CurrentUser() user: User,
    @Body() dto: UpdateProfileDto,
  ): Promise<ProfileResponseDto> {
    return this.meService.updateProfile(user.id, dto);
  }

  /**
   * 알림 설정 수정
   * POST /api/me/settings
   */
  @Post('settings')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '알림 설정 수정',
    description: '푸시 알림, 마케팅 알림 수신 동의 여부를 수정합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '알림 설정 수정 성공',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: '알림 설정이 수정되었습니다.' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: '잘못된 요청 데이터',
  })
  @ApiResponse({
    status: 401,
    description: '인증되지 않은 사용자',
  })
  async updateSettings(
    @CurrentUser() user: User,
    @Body() dto: UpdateSettingsDto,
  ): Promise<{ message: string }> {
    await this.meService.updateSettings(user.id, dto);
    return { message: '알림 설정이 수정되었습니다.' };
  }

  /**
   * 프로필 이미지 업로드
   * POST /api/me/profile-image
   */
  @Post('profile-image')
  @UseInterceptors(
    FileInterceptor('file', {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      storage: memoryStorage(),
      limits: {
        fileSize: 5 * 1024 * 1024, // 최대 5MB
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: '프로필 이미지 업로드',
    description:
      'multipart/form-data로 프로필 이미지를 직접 업로드합니다. 이미지는 S3에 저장되고 자동으로 프로필에 반영됩니다. (최대 5MB, jpeg/png/webp 형식)',
  })
  @ApiResponse({
    status: 201,
    description: '프로필 이미지 업로드 성공',
    schema: {
      type: 'object',
      properties: {
        profileImageUrl: {
          type: 'string',
          example: 'https://bucket.s3.region.amazonaws.com/profiles/xxx.jpg',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: '파일 검증 실패 (형식 또는 크기 초과)',
  })
  @ApiResponse({
    status: 401,
    description: '인증되지 않은 사용자',
  })
  async uploadProfileImage(
    @CurrentUser() user: User,
    @UploadedFile() file: MulterFile | undefined,
  ): Promise<{ profileImageUrl: string }> {
    if (!file) {
      throw new BadRequestException('파일이 필요합니다.');
    }

    // 파일 형식 검증
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        '프로필 이미지는 jpeg, png, webp 형식만 지원합니다.',
      );
    }

    // 파일 크기 검증 (5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new BadRequestException(
        '프로필 이미지는 최대 5MB까지 업로드 가능합니다.',
      );
    }

    return this.meService.uploadProfileImage(user.id, file);
  }

  /**
   * 참여중인 타임캡슐 리스트 조회
   * GET /api/me/capsules
   */
  @Get('capsules')
  @ApiOperation({
    summary: '참여중인 타임캡슐 리스트 조회',
    description:
      '사용자가 소유하거나 참여중인 타임캡슐 목록을 조회합니다. 페이지네이션을 지원합니다.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: '한 페이지에 표시할 아이템 수 (기본값: 20)',
    example: 20,
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    description: '건너뛸 아이템 수 (기본값: 0)',
    example: 0,
  })
  @ApiResponse({
    status: 200,
    description: '타임캡슐 리스트 조회 성공',
    type: PaginatedCapsuleResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: '인증되지 않은 사용자',
  })
  async getMyCapsules(
    @CurrentUser() user: User,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedCapsuleResponseDto> {
    return this.meService.getMyCapsules(user.id, query.limit, query.offset);
  }
}
