import { Body, Controller, Post, UseGuards } from '@nestjs/common';
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
}

