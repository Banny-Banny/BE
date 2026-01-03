import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../entities';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { GetOrderParamDto } from './dto/get-order.dto';
import { GetOrderStatusParamDto } from './dto/get-order-status.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrderStatusResponseDto } from './dto/order-status-response.dto';

@ApiTags('Orders')
@ApiBearerAuth('access-token')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: '타임캡슐 주문 생성 (결제 전)',
    description:
      'TIME_CAPSULE 상품에 대해 열람 시점/인원/사진/추가옵션을 검증하여 주문서를 생성하고 총액을 계산합니다.',
  })
  @ApiResponse({ status: 201, description: '주문 생성 성공' })
  @ApiResponse({ status: 400, description: '옵션/범위 검증 실패' })
  @ApiResponse({ status: 401, description: '인증 실패' })
  @ApiResponse({ status: 404, description: '상품 미존재/비활성/타입 불일치' })
  async create(@CurrentUser() user: User, @Body() dto: CreateOrderDto) {
    return this.ordersService.create(user, dto);
  }

  @Get(':orderId/status')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: '주문 상태 및 결제 정보 조회',
    description:
      '주문의 현재 상태, 결제 상태, 결제 금액, 승인 시각 등을 조회합니다. 주문자만 접근 가능.',
  })
  @ApiResponse({
    status: 200,
    description: '조회 성공',
    type: OrderStatusResponseDto,
  })
  @ApiResponse({ status: 401, description: '인증 실패' })
  @ApiResponse({ status: 403, description: '주문 소유권 불일치' })
  @ApiResponse({ status: 404, description: '주문 미존재' })
  async getStatus(
    @CurrentUser() user: User,
    @Param() params: GetOrderStatusParamDto,
  ): Promise<OrderStatusResponseDto> {
    return await this.ordersService.getStatus(user, params.orderId);
  }

  @Post(':orderId/status')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: '주문 상태 변경',
    description:
      '주문 상태를 변경하고 결제 정보와 일관성을 유지합니다. 주문자만 접근 가능. 유효한 상태 전환만 허용됩니다.',
  })
  @ApiResponse({
    status: 200,
    description: '상태 변경 성공',
    schema: {
      example: {
        order_id: 'uuid',
        order_status: 'CANCELED',
        payment_status: 'CANCELED',
        updated_at: '2025-01-19T02:00:00.000Z',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: '유효하지 않은 상태 전환 또는 요청 본문 오류',
  })
  @ApiResponse({ status: 401, description: '인증 실패' })
  @ApiResponse({ status: 403, description: '주문 소유권 불일치' })
  @ApiResponse({ status: 404, description: '주문 미존재' })
  async updateStatus(
    @CurrentUser() user: User,
    @Param() params: GetOrderStatusParamDto,
    @Body() dto: UpdateOrderStatusDto,
  ): Promise<{
    order_id: string;
    order_status: string;
    payment_status: string | null;
    updated_at: Date | null;
  }> {
    return await this.ordersService.updateStatus(
      user,
      params.orderId,
      dto.status,
    );
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: '주문 상세 조회',
    description:
      '주문 옵션/금액/상태와 연관 상품 제약을 조회합니다. 주문자만 접근 가능.',
  })
  @ApiResponse({
    status: 200,
    description: '조회 성공',
    schema: {
      example: {
        order: {
          order_id: 'uuid',
          status: 'PENDING_PAYMENT',
          total_amount: 3500,
          time_option: '1_WEEK',
          custom_open_at: null,
          headcount: 3,
          photo_count: 2,
          add_music: true,
          add_video: false,
          created_at: '2025-12-19T01:23:45.000Z',
          updated_at: '2025-12-19T01:23:45.000Z',
        },
        product: {
          id: 'uuid',
          product_type: 'TIME_CAPSULE',
          name: '기본 타임캡슐',
          price: 0,
          is_active: true,
          max_media_count: null,
          media_types: null,
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: '인증 실패' })
  @ApiResponse({ status: 403, description: '주문 소유권 불일치' })
  @ApiResponse({ status: 404, description: '주문/상품 미존재 또는 비활성' })
  async findOne(
    @CurrentUser() user: User,
    @Param() params: GetOrderParamDto,
  ): Promise<Awaited<ReturnType<OrdersService['findOne']>>> {
    return await this.ordersService.findOne(user, params.id);
  }
}
