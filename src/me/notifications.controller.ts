import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminJwtAuthGuard } from '../admin/auth/guards/admin-jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../entities';
import { NotificationsService } from './notifications.service';
import { PaginationQueryDto } from './dto/pagination.dto';
import {
  PaginatedNotificationResponseDto,
  UnreadCountResponseDto,
} from './dto/notification-response.dto';
import {
  SendNotificationDto,
  SendNotificationResponseDto,
} from './dto/send-notification.dto';

/**
 * 알림 관리 컨트롤러
 * 알림 조회, 읽음 처리, 발송 (관리자)
 */
@ApiTags('Me - Notifications (알림 관리)')
@ApiBearerAuth()
@Controller('me/notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * 알림 목록 조회
   * GET /api/me/notifications
   */
  @Get()
  @ApiOperation({
    summary: '알림 목록 조회',
    description:
      '사용자의 알림 목록을 조회합니다. 최신순으로 정렬되며 페이지네이션을 지원합니다.',
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
    description: '알림 목록 조회 성공',
    type: PaginatedNotificationResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: '인증되지 않은 사용자',
  })
  async getNotifications(
    @CurrentUser() user: User,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedNotificationResponseDto> {
    return this.notificationsService.getNotifications(
      user.id,
      query.limit,
      query.offset,
    );
  }

  /**
   * 읽지 않은 알림 개수 조회
   * GET /api/me/notifications/unread-count
   */
  @Get('unread-count')
  @ApiOperation({
    summary: '읽지 않은 알림 개수 조회',
    description: '사용자의 읽지 않은 알림 개수를 조회합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '읽지 않은 알림 개수 조회 성공',
    type: UnreadCountResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: '인증되지 않은 사용자',
  })
  async getUnreadCount(
    @CurrentUser() user: User,
  ): Promise<UnreadCountResponseDto> {
    return this.notificationsService.getUnreadCount(user.id);
  }

  /**
   * 알림 읽음 처리
   * POST /api/me/notifications/:notificationId/read
   */
  @Post(':notificationId/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '알림 읽음 처리',
    description: '특정 알림을 읽음 상태로 변경합니다.',
  })
  @ApiParam({
    name: 'notificationId',
    description: '알림 ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: '알림 읽음 처리 성공',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: '알림이 읽음 처리되었습니다.' },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: '인증되지 않은 사용자',
  })
  @ApiResponse({
    status: 404,
    description: '알림을 찾을 수 없음',
  })
  async markAsRead(
    @CurrentUser() user: User,
    @Param('notificationId') notificationId: string,
  ): Promise<{ message: string }> {
    await this.notificationsService.markAsRead(user.id, notificationId);
    return { message: '알림이 읽음 처리되었습니다.' };
  }

  /**
   * 알림 삭제
   * POST /api/me/notifications/:notificationId/delete
   */
  @Post(':notificationId/delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '알림 삭제',
    description: '특정 알림을 삭제합니다.',
  })
  @ApiParam({
    name: 'notificationId',
    description: '알림 ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: '알림 삭제 성공',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: '알림이 삭제되었습니다.' },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: '인증되지 않은 사용자',
  })
  @ApiResponse({
    status: 404,
    description: '알림을 찾을 수 없음',
  })
  async deleteNotification(
    @CurrentUser() user: User,
    @Param('notificationId') notificationId: string,
  ): Promise<{ message: string }> {
    await this.notificationsService.deleteNotification(user.id, notificationId);
    return { message: '알림이 삭제되었습니다.' };
  }
}

/**
 * 관리자 알림 발송 컨트롤러
 * 관리자 전용 기능
 */
@ApiTags('Admin - Notifications (관리자 알림 발송)')
@ApiBearerAuth('access-token')
@Controller('admin/notifications')
@UseGuards(AdminJwtAuthGuard)
export class AdminNotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * 알림 발송 (관리자 전용)
   * POST /api/admin/notifications
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: '알림 발송 (관리자 전용)',
    description:
      '특정 사용자 또는 전체 사용자에게 알림을 발송합니다. 관리자 권한이 필요합니다.',
  })
  @ApiResponse({
    status: 201,
    description: '알림 발송 성공',
    type: SendNotificationResponseDto,
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
    status: 403,
    description: '관리자 권한 필요',
  })
  @ApiResponse({
    status: 404,
    description: '대상 사용자를 찾을 수 없음',
  })
  async sendNotification(
    @Body() dto: SendNotificationDto,
  ): Promise<SendNotificationResponseDto> {
    return this.notificationsService.sendNotification(dto);
  }
}
