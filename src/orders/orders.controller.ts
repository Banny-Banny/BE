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
