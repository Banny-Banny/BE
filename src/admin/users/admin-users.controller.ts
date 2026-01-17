import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminJwtAuthGuard } from '../auth/guards/admin-jwt-auth.guard';
import { AdminUsersService } from './admin-users.service';
import { AdminUserListQueryDto } from './dto/admin-user-list-query.dto';
import { AdminUserUpdateDto } from './dto/admin-user-update.dto';

@ApiTags('Admin - Users')
@ApiBearerAuth('access-token')
@UseGuards(AdminJwtAuthGuard)
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  @ApiOperation({ summary: '유저 리스트 조회' })
  listUsers(@Query() query: AdminUserListQueryDto) {
    return this.adminUsersService.listUsers(query);
  }

  @Get(':id')
  @ApiOperation({ summary: '유저 상세 조회' })
  getUser(@Param('id') userId: string) {
    return this.adminUsersService.getUserDetail(userId);
  }

  @Post(':id')
  @ApiOperation({ summary: '유저 정보 수정' })
  updateUser(@Param('id') userId: string, @Body() dto: AdminUserUpdateDto) {
    return this.adminUsersService.updateUser(userId, dto);
  }

  @Post(':id/block')
  @ApiOperation({ summary: '유저 차단' })
  blockUser(@Param('id') userId: string) {
    return this.adminUsersService.blockUser(userId);
  }

  @Post(':id/unblock')
  @ApiOperation({ summary: '유저 차단 해제' })
  unblockUser(@Param('id') userId: string) {
    return this.adminUsersService.unblockUser(userId);
  }

  @Post(':id/deactivate')
  @ApiOperation({ summary: '유저 탈퇴 처리 (Soft Delete)' })
  deactivateUser(@Param('id') userId: string) {
    return this.adminUsersService.deactivateUser(userId);
  }
}
