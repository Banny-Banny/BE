import { ApiProperty } from '@nestjs/swagger';

export class PaymentItemDto {
  @ApiProperty({ description: '결제 키' })
  paymentKey: string | null;

  @ApiProperty({ description: '주문 번호' })
  orderNo: string | null;

  @ApiProperty({ description: '토스 결제 상태' })
  tossStatus: string | null;

  @ApiProperty({ description: '결제 수단' })
  method: string | null;

  @ApiProperty({ description: '통화' })
  currency: string;

  @ApiProperty({ description: '결제 금액' })
  amount: number;

  @ApiProperty({ description: '승인 일시' })
  approvedAt: string | null;

  @ApiProperty({ description: '영수증 URL' })
  receiptUrl: string | null;
}

export class GetMyPaymentsResponseDto {
  @ApiProperty({
    description: '결제 내역 목록',
    type: [PaymentItemDto],
  })
  payments: PaymentItemDto[];

  @ApiProperty({ description: '전체 결제 건수' })
  total: number;

  @ApiProperty({ description: '현재 페이지' })
  page: number;

  @ApiProperty({ description: '페이지당 항목 수' })
  limit: number;
}
