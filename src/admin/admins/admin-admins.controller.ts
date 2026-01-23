import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminJwtAuthGuard } from '../auth/guards/admin-jwt-auth.guard';
import { AdminAdminsService } from './admin-admins.service';
import { AdminAccountListQueryDto } from './dto/admin-account-list-query.dto';

@ApiTags('Admin - Admins')
@ApiBearerAuth('access-token')
@UseGuards(AdminJwtAuthGuard)
@Controller('admin')
export class AdminAdminsController {
  constructor(private readonly adminAdminsService: AdminAdminsService) {}

  @Get()
  @ApiOperation({ summary: '관리자 계정 목록 조회' })
  listAdmins(@Query() query: AdminAccountListQueryDto) {
    return this.adminAdminsService.listAdmins(query);
  }

  @Get('admins')
  @ApiOperation({ summary: '관리자 계정 목록 조회' })
  listAdminsAlias(@Query() query: AdminAccountListQueryDto) {
    return this.adminAdminsService.listAdmins(query);
  }
}
