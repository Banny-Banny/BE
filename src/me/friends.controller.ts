import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../entities';
import { FriendsService } from './friends.service';
import { AddFriendDto, AddFriendResponseDto } from './dto/add-friend.dto';
import { PaginationQueryDto } from './dto/pagination.dto';
import { PaginatedFriendResponseDto } from './dto/friend-list-response.dto';

/**
 * 친구 관리 컨트롤러
 * 친구 목록 조회, 친구 추가, 친구 삭제
 */
@ApiTags('Me - Friends (친구 관리)')
@ApiBearerAuth()
@Controller('me/friends')
@UseGuards(JwtAuthGuard)
export class FriendsController {
  constructor(private readonly friendsService: FriendsService) {}

  /**
   * 친구 목록 조회
   * GET /api/me/friends
   */
  @Get()
  @ApiOperation({
    summary: '친구 목록 조회',
    description: '사용자의 친구 목록을 조회합니다. 페이지네이션을 지원합니다.',
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
    description: '친구 목록 조회 성공',
    type: PaginatedFriendResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: '인증되지 않은 사용자',
  })
  async getFriends(
    @CurrentUser() user: User,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedFriendResponseDto> {
    return this.friendsService.getFriends(user.id, query.limit, query.offset);
  }

  /**
   * 친구 추가
   * POST /api/me/friends
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: '친구 추가',
    description:
      '전화번호로 친구를 추가합니다. 친구 관계는 자동으로 승인됩니다.',
  })
  @ApiResponse({
    status: 201,
    description: '친구 추가 성공',
    type: AddFriendResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: '잘못된 요청 데이터 (자기 자신 추가 시도)',
  })
  @ApiResponse({
    status: 401,
    description: '인증되지 않은 사용자',
  })
  @ApiResponse({
    status: 404,
    description: '해당 전화번호의 사용자를 찾을 수 없음',
  })
  @ApiResponse({
    status: 409,
    description: '이미 친구 관계이거나 차단된 사용자',
  })
  async addFriend(
    @CurrentUser() user: User,
    @Body() dto: AddFriendDto,
  ): Promise<AddFriendResponseDto> {
    return this.friendsService.addFriend(user.id, dto);
  }

  /**
   * 친구 삭제
   * DELETE /api/me/friends/:friendshipId
   */
  @Delete(':friendshipId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: '친구 삭제',
    description: '친구 관계를 삭제합니다.',
  })
  @ApiParam({
    name: 'friendshipId',
    description: '친구 관계 ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 204,
    description: '친구 삭제 성공',
  })
  @ApiResponse({
    status: 401,
    description: '인증되지 않은 사용자',
  })
  @ApiResponse({
    status: 403,
    description: '친구 관계를 삭제할 권한이 없음',
  })
  @ApiResponse({
    status: 404,
    description: '친구 관계를 찾을 수 없음',
  })
  async removeFriend(
    @CurrentUser() user: User,
    @Param('friendshipId') friendshipId: string,
  ): Promise<void> {
    return this.friendsService.removeFriend(user.id, friendshipId);
  }
}
