# Feature Specification: Admin 주문/결제 정산 대시보드 API

**Feature Branch**: `[023-admin-orders-payments]`  
**Created**: 2026-01-20  
**Status**: Draft  
**Input**: User description: "관리자 대시보드에서 주문내역/정산처리 API 추가"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 관리자 주문 리스트 조회 (Priority: P1)

관리자는 결제 상태, 기간, 유저 ID로 주문 내역을 필터링하여 리스트를 조회한다.

**Why this priority**: 정산/CS 처리의 기본 화면이므로 P1.  
**Independent Test**: `GET /admin/dashboard/orders?status=PAID&paymentStatus=PAID&limit=20&offset=0` → 200.

**Acceptance Scenarios**:
1. **Given** 결제 완료 주문 존재, **When** `/admin/dashboard/orders?paymentStatus=PAID` 요청, **Then** 결제 완료 주문만 반환된다.
2. **Given** 기간 필터, **When** `/admin/dashboard/orders?startDate=2026-01-01&endDate=2026-01-31`, **Then** 기간 내 주문만 반환된다.

---

### User Story 2 - 관리자 주문 상세 조회 (Priority: P1)

관리자는 주문 상세에서 상품 정보, 결제 수단, 영수증 URL을 확인한다.

**Why this priority**: 주문 단건 정산/CS 처리의 핵심이므로 P1.  
**Independent Test**: `GET /admin/dashboard/orders/:id` → 200.

**Acceptance Scenarios**:
1. **Given** 유효한 주문 ID, **When** `/admin/dashboard/orders/:id` 요청, **Then** 주문/상품/결제 정보가 반환된다.
2. **Given** 존재하지 않는 ID, **When** 요청, **Then** 404를 반환한다.

---

### User Story 3 - 관리자 주문 상태 수동 변경 (Priority: P1)

관리자는 무통장 입금 확인 등으로 주문 상태를 수동 변경한다.

**Why this priority**: 수기 정산 처리를 위한 필수 기능이므로 P1.  
**Independent Test**: `PATCH /admin/dashboard/orders/:id/status` → 200.

**Acceptance Scenarios**:
1. **Given** PENDING_PAYMENT 주문, **When** 상태를 PAID로 변경, **Then** 주문 상태가 갱신되고 대기실 생성이 수행된다.
2. **Given** 유효하지 않은 상태 전환, **When** 요청, **Then** 400을 반환한다.

---

### User Story 4 - 관리자 환불(결제 취소) 요청 (Priority: P1)

관리자는 PG사 환불 요청과 DB 상태 변경, 서비스 권한 회수를 단일 요청으로 처리한다.

**Why this priority**: 환불은 정산 오류/클레임 처리의 핵심이므로 P1.  
**Independent Test**: `POST /admin/dashboard/payments/:id/cancel` → 200.

**Acceptance Scenarios**:
1. **Given** 결제 완료 결제건, **When** 환불 요청, **Then** PG 환불 + 결제/주문 상태 변경이 함께 처리된다.
2. **Given** paymentKey 없음, **When** 요청, **Then** 400을 반환한다.

---

### User Story 5 - 결제 시도/실패 로그 조회 (Priority: P2)

관리자는 PG 에러 코드와 메시지를 조회해 CS 문의 대응에 활용한다.

**Why this priority**: 고객 문의 대응에 필요하나 핵심 결제 흐름보다 우선순위는 낮음.  
**Independent Test**: `GET /admin/dashboard/payments/logs?status=FAILED` → 200.

**Acceptance Scenarios**:
1. **Given** 실패 결제 로그 존재, **When** 조회, **Then** failCode/failMessage가 포함된다.

---

### User Story 6 - 영수증 재발급/전송 (Priority: P3)

관리자는 영수증 URL을 재조회하고 필요 시 재전송에 활용한다.

**Why this priority**: 선택 기능이며 P3.  
**Independent Test**: `POST /admin/dashboard/receipts/:orderId/issue` → 200.

**Acceptance Scenarios**:
1. **Given** 결제 완료 주문, **When** 요청, **Then** receipt URL이 반환된다.

