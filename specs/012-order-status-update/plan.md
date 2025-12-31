# Implementation Plan: 주문 결제정보 상태 변경 API

**Branch**: `012-order-status-update` | **Date**: 2025-01-19 | **Spec**: `specs/012-order-status-update/spec.md`  
**Input**: `/api/orders/{orderId}/status` 엔드포인트 구현 - 주문 상태 조회 및 변경, 결제 정보 동기화

## Summary
- 주문 상태 조회: `GET /api/orders/{orderId}/status`로 주문 상태(`OrderStatus`), 결제 상태(`PaymentStatus`), 결제 금액, 승인 시각 등을 반환한다.
- 주문 상태 변경: `PATCH /api/orders/{orderId}/status`로 주문 상태를 변경하고, 결제 정보(`Payment` 엔티티)와 일관성을 유지한다.
- 권한 검증: 주문 소유자만 접근 가능하도록 검증한다.
- 상태 전환 검증: 유효한 상태 전환만 허용한다 (예: `PENDING_PAYMENT` → `PAID`, `CANCELED`, `FAILED`).
- 트랜잭션 처리: 주문과 결제 정보 업데이트를 원자적으로 처리한다.

## Technical Context
- **Framework**: NestJS (Node.js)
- **Language**: TypeScript
- **Database**: PostgreSQL with TypeORM
- **Authentication**: JWT (기존 `JwtAuthGuard` 사용)
- **관련 모듈**: 
  - `orders.controller/service` (기존 주문 생성/조회 로직)
  - `payments.service` (결제 정보 관리)
  - `entities/order.entity` (Order 엔티티)
  - `entities/payment.entity` (Payment 엔티티)
- **Enum**: `OrderStatus`, `PaymentStatus` (이미 정의됨)
- **기존 패턴**: `OrdersService.findOne()`에서 주문 소유자 검증 로직 참고

## Plan / Steps

### 1) DTO 생성
- `GetOrderStatusParamDto`: `orderId` (uuid) 검증
- `UpdateOrderStatusDto`: `status` (OrderStatus enum) 검증
- `OrderStatusResponseDto`: 응답 스키마 정의 (주문 상태, 결제 상태, 금액, 시각 등)

### 2) Controller 엔드포인트 추가
- `GET /api/orders/:orderId/status`: 주문 상태 조회
  - `@UseGuards(JwtAuthGuard)` 적용
  - `@CurrentUser()` 데코레이터로 사용자 정보 추출
  - `OrdersService.getStatus()` 호출
- `PATCH /api/orders/:orderId/status`: 주문 상태 변경
  - `@UseGuards(JwtAuthGuard)` 적용
  - `@CurrentUser()` 데코레이터로 사용자 정보 추출
  - `OrdersService.updateStatus()` 호출

### 3) Service 로직 구현
- `OrdersService.getStatus(user: User, orderId: string)`:
  - 주문 존재 확인 (404)
  - 주문 소유자 검증 (403)
  - 결제 정보 조회 (있으면 포함, 없으면 null)
  - 주문 상태, 결제 상태, 금액, 시각 등 반환
- `OrdersService.updateStatus(user: User, orderId: string, status: OrderStatus)`:
  - 주문 존재 확인 (404)
  - 주문 소유자 검증 (403)
  - 유효한 상태 전환 검증 (400)
  - 트랜잭션으로 주문 상태 업데이트
  - 결제 정보가 있으면 결제 상태도 동기화
  - `updated_at` 필드 업데이트
  - 업데이트된 정보 반환

### 4) 상태 전환 검증 로직
- 유효한 상태 전환 규칙:
  - `PENDING_PAYMENT` → `PAID`, `CANCELED`, `FAILED` 허용
  - `PAID` → `CANCELED` 허용
  - `CANCELED`, `FAILED` → 변경 불가 (또는 관리자 권한 필요)
- 상태 전환 검증 함수: `validateStatusTransition(currentStatus, newStatus)`

### 5) 결제 정보 동기화 로직
- 주문 상태가 `PAID`로 변경되면:
  - 결제 정보가 있으면 `Payment.status`를 `PAID`로 업데이트
  - 결제 정보가 없으면 스킵 (결제 정보 없이도 주문 상태 변경 가능)
- 주문 상태가 `CANCELED`로 변경되면:
  - 결제 정보가 있으면 `Payment.status`를 `CANCELED`로 업데이트
  - 결제 정보가 없으면 스킵

### 6) 트랜잭션 처리
- `DataSource.transaction()` 사용
- 주문 업데이트와 결제 정보 업데이트를 동일 트랜잭션에서 처리
- 오류 발생 시 롤백 보장

### 7) Swagger 문서화
- `@ApiOperation()`: 엔드포인트 설명
- `@ApiResponse()`: 성공/실패 응답 스키마
- `@ApiBearerAuth()`: 인증 필요 명시

### 8) 테스트
- 단위 테스트:
  - 상태 전환 검증 로직
  - 주문 소유자 검증
  - 결제 정보 동기화 로직
- 통합 테스트 (Playwright):
  - 주문 상태 조회 성공 케이스
  - 주문 소유자가 아닌 사용자 접근 차단 (403)
  - 존재하지 않는 주문 조회 (404)
  - 유효한 상태 변경 성공
  - 유효하지 않은 상태 전환 차단 (400)
  - 트랜잭션 롤백 테스트

## Scope / Out of Scope

### 포함
- 주문 상태 조회 (`GET /api/orders/{orderId}/status`)
- 주문 상태 변경 (`PATCH /api/orders/{orderId}/status`)
- 주문 소유자 검증
- 결제 정보 동기화
- 상태 전환 검증
- 트랜잭션 처리

### 제외
- 관리자 권한 기반 상태 변경 (일반 사용자만 본인 주문 변경)
- 상태 변경 이력 로깅 (감사 로그 테이블 없음)
- 웹훅/콜백 처리 (PG사 연동은 기존 `payments.service`에서 처리)
- 주문 상태 자동 변경 (결제 승인 시 자동 변경은 기존 로직 유지)

## Risks / Checks

- **동시성 문제**: 동일 주문에 대한 동시 상태 변경 요청
  - 해결: TypeORM의 트랜잭션 격리 수준 활용, 필요시 비관적 락 적용
- **결제 정보 불일치**: 주문 상태와 결제 상태의 불일치
  - 해결: 트랜잭션으로 원자성 보장, 상태 변경 시 항상 동기화
- **상태 전환 검증 누락**: 유효하지 않은 상태 전환 허용
  - 해결: 명시적인 상태 전환 검증 함수 구현 및 테스트
- **권한 검증 누락**: 타인의 주문 상태 변경 허용
  - 해결: 기존 `findOne()` 메서드의 소유자 검증 로직 재사용

## Data Model

### 기존 엔티티 활용
- `Order` 엔티티: `status` 필드 (`OrderStatus` enum)
- `Payment` 엔티티: `status` 필드 (`PaymentStatus` enum), `orderId`로 주문과 1:1 관계

### 추가 DTO
- `GetOrderStatusParamDto`: Path parameter 검증
- `UpdateOrderStatusDto`: Request body 검증
- `OrderStatusResponseDto`: Response 스키마

## API 설계

### GET /api/orders/{orderId}/status
**인증**: Bearer JWT (필수)

**Path Parameters**:
- `orderId` (uuid, required)

**Response 200**:
```typescript
{
  order_id: string;
  order_status: OrderStatus;
  payment_status: PaymentStatus | null;
  total_amount: number;
  payment_amount: number | null;
  payment_key: string | null;
  approved_at: Date | null;
  created_at: Date;
  updated_at: Date | null;
}
```

**Error Responses**:
- 401: 인증 실패
- 403: 주문 소유권 불일치
- 404: 주문 미존재

### PATCH /api/orders/{orderId}/status
**인증**: Bearer JWT (필수)

**Path Parameters**:
- `orderId` (uuid, required)

**Request Body**:
```typescript
{
  status: OrderStatus;
}
```

**Response 200**:
```typescript
{
  order_id: string;
  order_status: OrderStatus;
  payment_status: PaymentStatus | null;
  updated_at: Date;
}
```

**Error Responses**:
- 400: 유효하지 않은 상태 전환 또는 요청 본문 오류
- 401: 인증 실패
- 403: 주문 소유권 불일치
- 404: 주문 미존재

