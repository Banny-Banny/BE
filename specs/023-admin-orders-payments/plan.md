# Implementation Plan: Admin 주문/결제 정산 대시보드 API

## Goals
- 관리자 대시보드(`/admin/dashboard`)에 주문/결제 정산 API를 추가한다.
- 주문 리스트/상세, 주문 상태 수동 변경, 결제 취소(환불), 결제 실패 로그, 영수증 재발급을 지원한다.

## Non-Goals
- 이메일/영수증 재전송 인프라 구축 (현재는 receipt URL 제공 수준).
- 프론트엔드 화면 구현.

## API Design
- `GET /admin/dashboard/orders`
  - Query: `status`, `paymentStatus`, `startDate`, `endDate`, `userId`, `limit`, `offset`
- `GET /admin/dashboard/orders/:id`
- `PATCH /admin/dashboard/orders/:id/status`
  - Body: `{ status: OrderStatus }`
- `POST /admin/dashboard/payments/:id/cancel`
  - Body: `{ cancelReason, cancelAmount?, refundReceiveAccount? }`
- `GET /admin/dashboard/payments/logs`
  - Query: `status`, `startDate`, `endDate`, `userId`, `limit`, `offset`
- `POST /admin/dashboard/receipts/:orderId/issue`
  - Body(선택): `{ email? }`

## Data Access
- `orders`, `payments`, `users`, `products`, `payment_cancels` 테이블 사용.
- 주문 접근 제어는 `AdminJwtAuthGuard`로 제한.
- 환불 처리 시 주문/결제 상태 변경을 하나의 트랜잭션으로 처리.

## Implementation Steps
1. 관리자 대시보드 DTO 추가 (필터/상태 변경/영수증 요청).
2. `AdminDashboardService`에 주문/결제 조회 로직 추가.
3. `PaymentsService`에 관리자 환불 및 영수증 재조회 기능 추가.
4. `AdminDashboardController`에 신규 라우트 추가.
5. `AdminModule`/`PaymentsModule` 의존성 및 export 업데이트.
6. 최소한의 응답 스키마 정리 및 스웨거 문구 업데이트.

## Testing Notes
- 기존 테스트 없음 → 수동 호출로 스모크 테스트.
- 환불 API는 `TOSS_PAY_ENABLE=false` 환경에서 목 경로 확인.

