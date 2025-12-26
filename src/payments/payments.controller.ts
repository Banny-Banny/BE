import {
  Body,
  Controller,
  Post,
  UseGuards,
  HttpCode,
  Get,
  Param,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../entities';
import { PaymentsService } from './payments.service';
import { KakaoReadyDto } from './dto/kakao-ready.dto';
import { KakaoApproveDto } from './dto/kakao-approve.dto';
import { TossConfirmDto } from './dto/toss-confirm.dto';
import { TossCancelDto } from './dto/toss-cancel.dto';

@ApiTags('Payments')
@ApiBearerAuth('access-token')
@Controller('payments/kakao')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('ready')
  @HttpCode(201)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: '카카오페이 결제 준비',
    description: '주문(PENDING_PAYMENT)을 검증 후 카카오페이 결제 URL과 tid를 반환합니다.',
  })
  @ApiResponse({ status: 201, description: '준비 성공' })
  @ApiResponse({ status: 400, description: '검증 실패/상태 불일치' })
  @ApiResponse({ status: 401, description: '인증 실패' })
  @ApiResponse({ status: 404, description: '주문/상품 미존재' })
  async ready(@CurrentUser() user: User, @Body() dto: KakaoReadyDto) {
    return this.paymentsService.kakaoReady(user, dto);
  }

  @Post('approve')
  @HttpCode(201)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: '카카오페이 결제 승인',
    description: 'tid/pg_token을 확인하여 결제 승인을 완료하고 주문 상태를 갱신합니다.',
  })
  @ApiResponse({ status: 201, description: '승인 성공' })
  @ApiResponse({ status: 400, description: '검증 실패/상태 불일치' })
  @ApiResponse({ status: 401, description: '인증 실패' })
  @ApiResponse({ status: 404, description: '주문/상품/결제 미존재' })
  async approve(@CurrentUser() user: User, @Body() dto: KakaoApproveDto) {
    return this.paymentsService.kakaoApprove(user, dto);
  }
}

@ApiTags('Payments')
@ApiBearerAuth('access-token')
@Controller('payments/toss')
export class TossPaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('confirm')
  @HttpCode(201)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: '토스페이먼츠 결제 승인',
    description: 'paymentKey/orderId/amount으로 토스 결제를 승인하고 저장합니다.',
  })
  @ApiResponse({ status: 201, description: '승인 성공' })
  @ApiResponse({ status: 400, description: '검증 실패/상태 불일치' })
  @ApiResponse({ status: 401, description: '인증 실패' })
  async confirm(@CurrentUser() user: User, @Body() dto: TossConfirmDto) {
    return this.paymentsService.tossConfirm(user, dto);
  }

  @Get(':paymentKey')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: '토스 결제 단건 조회 (paymentKey)',
  })
  async getByPaymentKey(@Param('paymentKey') paymentKey: string) {
    return this.paymentsService.tossGetByPaymentKey(paymentKey);
  }

  @Get('orders/:orderNo')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: '토스 결제 단건 조회 (orderId)',
  })
  async getByOrderNo(@Param('orderNo') orderNo: string) {
    return this.paymentsService.tossGetByOrderNo(orderNo);
  }

  @Post(':paymentKey/cancel')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: '토스 결제 취소',
    description: 'paymentKey로 전액/부분 취소하고 취소 이력을 저장합니다.',
  })
  @ApiResponse({ status: 200, description: '취소 성공' })
  async cancel(
    @CurrentUser() user: User,
    @Param('paymentKey') paymentKey: string,
    @Body() dto: TossCancelDto,
  ) {
    return this.paymentsService.tossCancel(user, { ...dto, paymentKey });
  }
}

