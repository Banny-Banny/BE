import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AdminAuthService, AdminTokenResponse } from './admin-auth.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { AdminCreateDto } from './dto/admin-create.dto';
import { AdminRefreshDto } from './dto/admin-refresh.dto';
import { AdminJwtAuthGuard } from './guards/admin-jwt-auth.guard';
import { CurrentAdmin } from './decorators/current-admin.decorator';
import { AdminUser } from '../../entities';

@ApiTags('Admin - Auth')
@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '관리자 로그인' })
  @ApiResponse({ status: 200, description: '로그인 성공' })
  login(@Body() dto: AdminLoginDto): Promise<AdminTokenResponse> {
    return this.adminAuthService.login(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '관리자 토큰 재발급' })
  @ApiResponse({ status: 200, description: '재발급 성공' })
  refresh(@Body() dto: AdminRefreshDto): Promise<AdminTokenResponse> {
    return this.adminAuthService.refresh(dto);
  }

  @Post('logout')
  @UseGuards(AdminJwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '관리자 로그아웃' })
  async logout(@CurrentAdmin() admin: AdminUser) {
    await this.adminAuthService.logout(admin);
    return { success: true };
  }

  @Post('admins')
  @UseGuards(AdminJwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '관리자 계정 생성 (슈퍼 어드민 전용)' })
  createAdmin(@CurrentAdmin() admin: AdminUser, @Body() dto: AdminCreateDto) {
    return this.adminAuthService.createAdmin(admin, dto);
  }

  @Get('me')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '관리자 프로필 조회' })
  getProfile(@CurrentAdmin() admin: AdminUser) {
    return this.adminAuthService.getProfile(admin);
  }
}
