import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../entities';
import { CapsulesStepRoomService } from './capsules-step-room.service';
import {
  StepRoomResponseDto,
  StepRoomDetailDto,
} from './dto/step-room-response.dto';
import { StepRoomSettingsResponseDto } from './dto/step-room-settings.dto';
import { SaveContentDto } from './dto/save-content.dto';
import { ContentResponseDto } from './dto/content-response.dto';
import { SubmitCapsuleDto } from './dto/submit-capsule.dto';
import { SubmitCapsuleResponseDto } from './dto/submit-capsule-response.dto';
import { CreateStepRoomDto } from './dto/create-step-room.dto';
import { CreateStepRoomResponseDto } from './dto/create-step-room-response.dto';
import {
  JoinStepRoomDto,
  JoinStepRoomResponseDto,
} from './dto/join-step-room.dto';
import { GetMyContentResponseDto } from './dto/get-my-content-response.dto';

// Multer 파일 타입 정의
interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/**
 * Step Room (대기실) 전용 컨트롤러
 *
 * 기존 엔드포인트 경로를 유지하기 위해 @Controller('capsules')를 사용하며,
 * 모든 엔드포인트는 'step-rooms' 접두사를 가집니다.
 *
 * 엔드포인트:
 * - GET /capsules/step-rooms/by-code - 초대 코드로 대기실 조회
 * - GET /capsules/step-rooms/:capsuleId/settings - 대기실 설정 조회
 * - GET /capsules/step-rooms/:capsuleId - 대기실 상세 조회
 * - POST /capsules/step-rooms/:capsuleId/my-content - 콘텐츠 저장
 * - POST /capsules/step-rooms/:capsuleId/submit - 최종 제출
 */
@ApiTags('Capsules - Step Room')
@Controller('capsules/step-rooms')
export class CapsulesStepRoomController {
  constructor(private readonly stepRoomService: CapsulesStepRoomService) {}

  @Post('create')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '타임캡슐(대기실) 생성',
    description:
      '결제 완료(PAID)된 주문으로 타임캡슐을 생성합니다. 생성 시 대기실 초대 코드가 발급되며, 24시간 내에 참여자들이 콘텐츠를 작성해야 합니다.',
  })
  @ApiResponse({
    status: 201,
    description: '타임캡슐 생성 성공',
    type: CreateStepRoomResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: '잘못된 요청 (결제 미완료, 인원수 오류 등)',
    schema: {
      example: {
        success: false,
        error: 'BAD_REQUEST',
        message: '결제 완료된 주문만 대기실을 생성할 수 있습니다',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: '주문을 찾을 수 없음',
    schema: {
      example: {
        success: false,
        error: 'NOT_FOUND',
        message: '주문을 찾을 수 없습니다',
      },
    },
  })
  @ApiResponse({
    status: 409,
    description: '이미 생성된 캡슐이 존재함',
    schema: {
      example: {
        success: false,
        error: 'ALREADY_EXISTS',
        message: '이 주문으로 이미 캡슐이 생성되었습니다',
      },
    },
  })
  async createStepRoom(
    @CurrentUser() user: User,
    @Body() createStepRoomDto: CreateStepRoomDto,
  ): Promise<CreateStepRoomResponseDto> {
    const capsule = await this.stepRoomService.createCapsuleWithStepRoom(
      createStepRoomDto.order_id,
    );

    const inviteCode = capsule.inviteCode!;
    const shareLink = `timeegg://room/join?invite_code=${inviteCode}`;

    return {
      capsule_id: capsule.id,
      invite_code: inviteCode,
      title: capsule.title,
      open_date: capsule.openAt!,
      deadline: capsule.deadline!,
      max_participants: capsule.viewLimit,
      current_participants: 1, // 생성 시점에는 방장만 참여
      status: capsule.roomStatus!,
      created_at: capsule.createdAt,
      share_link: shareLink,
    };
  }

  @Get('by-code')
  @ApiOperation({ summary: '초대 코드로 대기실 조회' })
  @ApiQuery({
    name: 'invite_code',
    required: true,
    description: '초대 코드 (6자리 영숫자)',
    example: 'R2Q6VZ',
  })
  @ApiResponse({
    status: 200,
    description: '대기실 정보 조회 성공',
    type: StepRoomResponseDto,
  })
  @ApiResponse({ status: 404, description: '존재하지 않는 초대 코드' })
  @ApiResponse({ status: 400, description: '초대 코드 누락/형식 오류' })
  async getStepRoomByInviteCode(
    @Query('invite_code') inviteCode?: string,
  ): Promise<StepRoomResponseDto> {
    if (!inviteCode) {
      throw new BadRequestException('INVITE_CODE_REQUIRED');
    }
    if (inviteCode.length !== 6) {
      throw new BadRequestException('INVITE_CODE_INVALID');
    }
    return this.stepRoomService.findCapsuleByInviteCode(inviteCode);
  }

  @Get(':capsuleId/settings')
  @ApiOperation({
    summary: '대기실 설정값 조회',
    description:
      '방장이 인포에서 설정한 값 조회. 프론트엔드에서 업로드 UI 제어에 사용',
  })
  @ApiResponse({
    status: 200,
    description: '설정값 조회 성공',
    type: StepRoomSettingsResponseDto,
  })
  @ApiResponse({ status: 404, description: '대기실을 찾을 수 없음' })
  async getStepRoomSettings(
    @Param('capsuleId') capsuleId: string,
  ): Promise<StepRoomSettingsResponseDto> {
    return this.stepRoomService.getStepRoomSettings(capsuleId);
  }

  @Get(':capsuleId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '대기실 상세 조회 (참여자 전용)' })
  @ApiQuery({
    name: 'invite_code',
    required: false,
    description: '초대 코드 (6자리) - 아직 슬롯이 배정되지 않은 경우 필수',
  })
  @ApiResponse({
    status: 200,
    description: '대기실 상세 정보 조회 성공',
    type: StepRoomDetailDto,
  })
  @ApiResponse({ status: 403, description: '참여자만 조회 가능' })
  @ApiResponse({ status: 404, description: '대기실을 찾을 수 없음' })
  async getStepRoomDetail(
    @Param('capsuleId') capsuleId: string,
    @CurrentUser() user: User,
    @Query('invite_code') inviteCode?: string,
  ): Promise<StepRoomDetailDto> {
    return this.stepRoomService.getStepRoomDetail(
      capsuleId,
      user.id,
      inviteCode,
    );
  }

  @Post(':capsuleId/join')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '대기실 참여 (슬롯 배정)',
    description:
      '초대 코드를 이용하여 대기실에 참여합니다. 빈 슬롯 중 가장 앞 번호에 자동 배정됩니다.',
  })
  @ApiResponse({
    status: 201,
    description: '참여 성공',
    type: JoinStepRoomResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: '잘못된 초대 코드, 마감시한 경과, 또는 정원 초과',
    schema: {
      example: {
        success: false,
        error: 'SLOTS_FULL',
        message: '정원이 초과되었습니다',
        data: {
          max_participants: 4,
          current_participants: 4,
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: '존재하지 않는 대기실',
    schema: {
      example: {
        success: false,
        error: 'NOT_FOUND',
        message: '대기실을 찾을 수 없습니다',
      },
    },
  })
  @ApiResponse({
    status: 409,
    description: '이미 참여 중',
    schema: {
      example: {
        success: false,
        error: 'ALREADY_JOINED',
        message: '이미 참여 중입니다',
        data: {
          slot_number: 2,
        },
      },
    },
  })
  async joinStepRoom(
    @Param('capsuleId', ParseUUIDPipe) capsuleId: string,
    @CurrentUser() user: User,
    @Body() joinDto: JoinStepRoomDto,
  ): Promise<JoinStepRoomResponseDto> {
    return await this.stepRoomService.joinStepRoom(
      capsuleId,
      user.id,
      joinDto.invite_code,
    );
  }

  @Post(':capsuleId/my-content')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'images', maxCount: 5 },
      { name: 'music', maxCount: 1 },
      { name: 'video', maxCount: 1 },
    ]),
  )
  @ApiOperation({
    summary: '스텝룸 콘텐츠 저장',
    description:
      '스텝룸에 참여한 사용자가 자신의 콘텐츠(텍스트, 이미지, 음성, 동영상)를 저장합니다. 한번에 모든 콘텐츠를 저장하며, 재저장(수정)이 가능합니다.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({
    status: 200,
    description: '콘텐츠 저장 성공',
    type: ContentResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: '잘못된 요청 (미디어 설정 위반 등)',
    schema: {
      example: {
        success: false,
        error: 'IMAGE_LIMIT_EXCEEDED',
        message: '사진은 최대 3장까지 업로드할 수 있습니다',
        data: {
          max_images: 3,
          uploaded_images: 5,
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: '권한 없음 또는 인원 초과',
    schema: {
      example: {
        success: false,
        error: 'UNAUTHORIZED_ACCESS',
        message: '이 캡슐에 접근할 권한이 없습니다',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: '캡슐 또는 사용자를 찾을 수 없음',
    schema: {
      example: {
        success: false,
        error: 'CAPSULE_NOT_FOUND',
        message: '캡슐을 찾을 수 없습니다',
      },
    },
  })
  @ApiResponse({
    status: 409,
    description: '슬롯이 모두 배정됨',
    schema: {
      example: {
        success: false,
        error: 'SLOTS_FULL',
        message: '모든 슬롯이 이미 배정되었습니다',
      },
    },
  })
  async saveMyContent(
    @Param('capsuleId', ParseUUIDPipe) capsuleId: string,
    @CurrentUser() user: User,
    @Body() saveContentDto: SaveContentDto,
    @UploadedFiles()
    files: {
      images?: MulterFile[];
      music?: MulterFile[];
      video?: MulterFile[];
    },
  ): Promise<ContentResponseDto> {
    return this.stepRoomService.saveMyContent(
      capsuleId,
      user.id,
      saveContentDto,
      files,
    );
  }

  @Get(':capsuleId/my-content')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '본인이 작성한 콘텐츠 조회',
    description:
      '대기실에서 본인이 작성한 콘텐츠를 조회합니다. 대기실을 나갔다가 다시 들어올 때 이전에 작성한 내용을 확인할 수 있습니다.',
  })
  @ApiResponse({
    status: 200,
    description: '콘텐츠 조회 성공',
    type: GetMyContentResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: '인증 실패',
    schema: {
      example: {
        statusCode: 401,
        message: 'Unauthorized',
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: '참여자가 아님',
    schema: {
      example: {
        success: false,
        error: 'NOT_PARTICIPANT',
        message: '이 캡슐의 참여자가 아닙니다',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: '콘텐츠를 작성하지 않음',
    schema: {
      example: {
        success: false,
        error: 'CONTENT_NOT_FOUND',
        message: '아직 작성하지 않았습니다',
      },
    },
  })
  async getMyContent(
    @Param('capsuleId', ParseUUIDPipe) capsuleId: string,
    @CurrentUser() user: User,
  ): Promise<GetMyContentResponseDto> {
    return this.stepRoomService.getMyContent(capsuleId, user.id);
  }

  @Post(':capsuleId/submit')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '타임캡슐 최종 제출',
    description:
      '방장이 모든 참여자 완료 후 현재 위치에 타임캡슐을 매장합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '제출 성공',
    type: SubmitCapsuleResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: '권한 없음',
    schema: {
      example: {
        success: false,
        error: 'NOT_ROOM_OWNER',
        message: '방장만 최종 제출할 수 있습니다',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: '참여자 미완료',
    schema: {
      example: {
        success: false,
        error: 'INCOMPLETE_PARTICIPANTS',
        message: '모든 참여자가 저장을 완료해야 제출할 수 있습니다',
        data: {
          completed: 2,
          total: 4,
          incomplete_users: ['박초롱', '김철수'],
        },
      },
    },
  })
  @ApiResponse({
    status: 409,
    description: '이미 제출됨',
    schema: {
      example: {
        success: false,
        error: 'ALREADY_SUBMITTED',
        message: '이미 제출된 캡슐입니다',
      },
    },
  })
  async submitCapsule(
    @Param('capsuleId', ParseUUIDPipe) capsuleId: string,
    @CurrentUser() user: User,
    @Body() submitDto: SubmitCapsuleDto,
  ): Promise<SubmitCapsuleResponseDto> {
    return this.stepRoomService.submitCapsule(
      capsuleId,
      user.id,
      submitDto.latitude,
      submitDto.longitude,
    );
  }
}
