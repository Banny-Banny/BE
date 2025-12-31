# Feature Specification: 주문 결제정보 상태 변경 API

**Feature Branch**: `[012-order-status-update]`  
**Created**: 2025-01-19  
**Status**: Draft  
**Input**: User description: "/api/orders/{orderId}/status 구현 명세작성해 주문 결재정보 상태변경기능을 구현할거야"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 주문 상태 조회 (Priority: P1)

사용자는 자신이 생성한 주문의 현재 상태와 결제 정보를 조회할 수 있다.

**Why this priority**: 주문 상태 확인은 사용자가 결제 진행 상황을 파악하는 핵심 기능이다.

**Independent Test**: 인증된 사용자가 자신의 주문 ID로 상태 조회 API를 호출하면 주문 상태, 결제 상태, 관련 정보가 반환되는지 확인.

**Acceptance Scenarios**:

1. **Given** 사용자가 생성한 주문이 있고, **When** 주문 소유자가 `GET /api/orders/{orderId}/status`를 호출하면, **Then** 주문 상태(`OrderStatus`), 결제 상태(`PaymentStatus`), 결제 금액, 결제 승인 시각 등이 반환된다.
2. **Given** 다른 사용자의 주문 ID로 요청할 때, **When** 상태 조회 API를 호출하면, **Then** 403(Forbidden)이 반환된다.
3. **Given** 존재하지 않는 주문 ID로 요청할 때, **When** 상태 조회 API를 호출하면, **Then** 404(Not Found)가 반환된다.

---

### User Story 2 - 주문 상태 수동 변경 (Priority: P2)

관리자 또는 시스템이 특정 상황에서 주문 상태를 수동으로 변경할 수 있다.

**Why this priority**: 결제 실패, 환불 처리, 시스템 오류 복구 등 운영상 필요한 상태 변경 기능이다.

**Independent Test**: 유효한 주문 ID와 상태 변경 요청에 대해 상태가 정상적으로 업데이트되고, 결제 정보와의 일관성이 유지되는지 확인.

**Acceptance Scenarios**:

1. **Given** `PENDING_PAYMENT` 상태의 주문이 있고, **When** 관리자가 상태를 `CANCELED`로 변경하면, **Then** 주문 상태가 업데이트되고 관련 결제 정보도 일관성 있게 처리된다.
2. **Given** `PAID` 상태의 주문에 대해, **When** 환불 처리로 상태를 `CANCELED`로 변경하면, **Then** 주문 상태와 결제 상태가 모두 적절히 업데이트된다.
3. **Given** 유효하지 않은 상태 전환(예: `PAID` → `PENDING_PAYMENT`)을 요청할 때, **When** 상태 변경 API를 호출하면, **Then** 400(Bad Request)가 반환된다.

---

### User Story 3 - 결제 정보 동기화 (Priority: P1)

주문 상태 변경 시 결제 정보(`Payment` 엔티티)와의 일관성을 유지한다.

**Why this priority**: 주문과 결제 정보의 불일치는 재무적 문제와 데이터 무결성 문제를 야기할 수 있다.

**Independent Test**: 주문 상태 변경 시 결제 정보가 함께 업데이트되고, 트랜잭션으로 원자성이 보장되는지 확인.

**Acceptance Scenarios**:

1. **Given** 주문에 연결된 결제 정보가 있고, **When** 주문 상태를 `PAID`로 변경하면, **Then** 결제 상태도 `PAID`로 동기화된다.
2. **Given** 주문 상태를 `CANCELED`로 변경할 때, **When** 결제 정보가 존재하면, **Then** 결제 상태도 `CANCELED`로 업데이트되거나 적절히 처리된다.
3. **Given** 주문과 결제 정보 업데이트 중 오류가 발생할 때, **When** 트랜잭션이 롤백되면, **Then** 두 엔티티 모두 변경 전 상태로 유지된다.

---

### Edge Cases

- 존재하지 않는 주문 ID 요청 처리
- 주문 소유자가 아닌 사용자의 접근 차단
- 유효하지 않은 상태 전환 시도(예: `PAID` → `PENDING_PAYMENT`)
- 결제 정보가 없는 주문의 상태 변경 처리
- 동시성 문제: 동일 주문에 대한 동시 상태 변경 요청
- 이미 `CANCELED` 또는 `FAILED` 상태인 주문의 추가 변경 시도
- 결제 정보와 주문 상태의 불일치 상황 복구

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 시스템은 `GET /api/orders/{orderId}/status` 요청 시 주문 소유자만 접근 가능하도록 검증해야 한다(403 반환).
- **FR-002**: 시스템은 주문 상태 조회 시 주문 상태(`OrderStatus`), 결제 상태(`PaymentStatus`), 결제 금액, 결제 승인 시각, 주문 생성 시각, 최종 업데이트 시각을 반환해야 한다.
- **FR-003**: 시스템은 존재하지 않는 주문 ID 요청 시 404를 반환해야 한다.
- **FR-004**: 시스템은 주문 상태 변경 시 유효한 상태 전환만 허용해야 한다:
  - `PENDING_PAYMENT` → `PAID`, `CANCELED`, `FAILED`
  - `PAID` → `CANCELED`
  - `CANCELED`, `FAILED` → 변경 불가 (또는 관리자 권한 필요)
- **FR-005**: 시스템은 주문 상태 변경 시 결제 정보(`Payment` 엔티티)와의 일관성을 유지해야 한다:
  - 주문 상태가 `PAID`로 변경되면 결제 상태도 `PAID`로 동기화
  - 주문 상태가 `CANCELED`로 변경되면 결제 상태도 `CANCELED`로 동기화 (결제 정보가 존재하는 경우)
- **FR-006**: 시스템은 주문 상태 변경을 트랜잭션으로 처리하여 주문과 결제 정보의 원자성을 보장해야 한다.
- **FR-007**: 시스템은 주문 상태 변경 시 `updated_at` 필드를 현재 시각으로 업데이트해야 한다.
- **FR-008**: 시스템은 주문 상태 변경 이력을 [NEEDS CLARIFICATION: 로그 테이블 또는 감사 로그에 기록할지 여부 미정]에 기록해야 한다.
- **FR-009**: 시스템은 `PATCH /api/orders/{orderId}/status` 요청 시 요청 본문에 `status` 필드(enum 값)를 포함해야 한다.
- **FR-010**: 시스템은 주문 상태 변경 시 주문 소유자 검증을 수행해야 한다(403 반환).
- **FR-011**: 시스템은 결제 정보가 없는 주문에 대해서도 상태 변경을 허용해야 한다(결제 정보 동기화는 스킵).
- **FR-012**: 시스템은 동시성 문제를 방지하기 위해 [NEEDS CLARIFICATION: 낙관적/비관적 락 사용 여부 미정]을 적용해야 한다.

### Key Entities *(include if feature involves data)*

- **Order**: 주문 정보. `status` 필드(`OrderStatus` enum)를 가진다. `userId`, `totalAmount`, `createdAt`, `updatedAt` 등을 포함한다.
- **Payment**: 결제 정보. `status` 필드(`PaymentStatus` enum)를 가진다. `orderId`로 주문과 1:1 관계를 가진다. `paymentKey`, `amount`, `approvedAt` 등을 포함한다.
- **OrderStatus**: 주문 상태 enum (`PENDING`, `PENDING_PAYMENT`, `PAID`, `CANCELED`, `FAILED`)
- **PaymentStatus**: 결제 상태 enum (`READY`, `PAID`, `CANCELED`, `FAILED`)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `GET /api/orders/{orderId}/status` 요청에 대해 95퍼센트타일 응답 시간이 200ms 이하 (정상/권한 보유 기준).
- **SC-002**: 주문 소유자가 아닌 요청에서 100% 403을 반환(권한 없는 정보 노출 없음).
- **SC-003**: 주문 상태 변경 시 주문과 결제 정보의 일관성이 100% 유지됨(트랜잭션 보장).
- **SC-004**: 유효하지 않은 상태 전환 요청에 대해 100% 400을 반환.
- **SC-005**: 존재하지 않는 주문 ID 요청에 대해 100% 404를 반환.

## API 명세

### GET /api/orders/{orderId}/status

주문 상태 및 결제 정보 조회

**인증**: Bearer JWT (필수)

**Path Parameters**:
- `orderId` (uuid, required): 주문 ID

**Response 200**:
```json
{
  "order_id": "uuid",
  "order_status": "PENDING_PAYMENT",
  "payment_status": "READY",
  "total_amount": 3500,
  "payment_amount": null,
  "payment_key": null,
  "approved_at": null,
  "created_at": "2025-01-19T01:23:45.000Z",
  "updated_at": "2025-01-19T01:23:45.000Z"
}
```

**Response 401**: 인증 실패
**Response 403**: 주문 소유권 불일치
**Response 404**: 주문 미존재

---

### PATCH /api/orders/{orderId}/status

주문 상태 변경

**인증**: Bearer JWT (필수)

**Path Parameters**:
- `orderId` (uuid, required): 주문 ID

**Request Body**:
```json
{
  "status": "CANCELED"
}
```

**Response 200**:
```json
{
  "order_id": "uuid",
  "order_status": "CANCELED",
  "payment_status": "CANCELED",
  "updated_at": "2025-01-19T02:00:00.000Z"
}
```

**Response 400**: 유효하지 않은 상태 전환 또는 요청 본문 오류
**Response 401**: 인증 실패
**Response 403**: 주문 소유권 불일치
**Response 404**: 주문 미존재

