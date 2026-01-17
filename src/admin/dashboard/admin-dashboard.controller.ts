import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminJwtAuthGuard } from '../auth/guards/admin-jwt-auth.guard';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminDashboardChartQueryDto } from './dto/admin-dashboard-chart-query.dto';

@ApiTags('Admin - Dashboard')
@ApiBearerAuth('access-token')
@UseGuards(AdminJwtAuthGuard)
@Controller('admin/dashboard')
export class AdminDashboardController {
  constructor(private readonly adminDashboardService: AdminDashboardService) {}

  @Get('summary')
  @ApiOperation({ summary: '대시보드 요약 지표 조회' })
  getSummary() {
    return this.adminDashboardService.getSummary();
  }

  @Get('charts')
  @ApiOperation({ summary: '대시보드 차트 데이터 조회' })
  getCharts(@Query() query: AdminDashboardChartQueryDto) {
    return this.adminDashboardService.getCharts(query);
  }
}
