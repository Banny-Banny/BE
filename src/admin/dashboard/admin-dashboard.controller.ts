import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminJwtAuthGuard } from '../auth/guards/admin-jwt-auth.guard';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminDashboardChartQueryDto } from './dto/admin-dashboard-chart-query.dto';
import { AdminOrderListQueryDto } from './dto/admin-order-list-query.dto';
import { AdminOrderStatusUpdateDto } from './dto/admin-order-status-update.dto';
import { AdminPaymentLogsQueryDto } from './dto/admin-payment-logs-query.dto';
import { AdminReceiptIssueDto } from './dto/admin-receipt-issue.dto';
import { AdminPaymentCancelDto } from './dto/admin-payment-cancel.dto';

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

  @Get('orders')
  @ApiOperation({ summary: '주문 리스트 조회' })
  getOrders(@Query() query: AdminOrderListQueryDto) {
    return this.adminDashboardService.getOrders(query);
  }

  @Get('orders/:id')
  @ApiOperation({ summary: '주문 상세 조회' })
  getOrderDetail(@Param('id') orderId: string) {
    return this.adminDashboardService.getOrderDetail(orderId);
  }

  @Patch('orders/:id/status')
  @ApiOperation({ summary: '주문 상태 수동 변경' })
  updateOrderStatus(
    @Param('id') orderId: string,
    @Body() dto: AdminOrderStatusUpdateDto,
  ) {
    return this.adminDashboardService.updateOrderStatus(orderId, dto);
  }

  @Post('payments/:id/cancel')
  @HttpCode(200)
  @ApiOperation({ summary: '결제 취소(환불) 요청' })
  cancelPayment(
    @Param('id') paymentId: string,
    @Body() dto: AdminPaymentCancelDto,
  ) {
    return this.adminDashboardService.cancelPayment(paymentId, dto);
  }

  @Get('payments/logs')
  @ApiOperation({ summary: '결제 시도/실패 로그 조회' })
  getPaymentLogs(@Query() query: AdminPaymentLogsQueryDto) {
    return this.adminDashboardService.getPaymentLogs(query);
  }

  @Post('receipts/:orderId/issue')
  @HttpCode(200)
  @ApiOperation({ summary: '영수증 재발급/전송' })
  issueReceipt(
    @Param('orderId') orderId: string,
    @Body() dto: AdminReceiptIssueDto,
  ) {
    return this.adminDashboardService.issueReceipt(orderId, dto);
  }
}
