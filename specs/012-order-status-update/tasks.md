# Tasks: 주문 결제정보 상태 변경 API

**Input**: Design documents from `/specs/012-order-status-update/`
**Prerequisites**: plan.md, spec.md

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: DTO 및 기본 구조 생성

- [ ] T001 [P] [US1] DTO 생성: `GetOrderStatusParamDto` in `src/orders/dto/get-order-status.dto.ts`
- [ ] T002 [P] [US2] DTO 생성: `UpdateOrderStatusDto` in `src/orders/dto/update-order-status.dto.ts`
- [ ] T003 [P] [US1,US2] DTO 생성: `OrderStatusResponseDto` in `src/orders/dto/order-status-response.dto.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 상태 전환 검증 로직 및 유틸리티 함수

**⚠️ CRITICAL**: 상태 전환 검증 로직은 모든 상태 변경 작업의 전제 조건

- [ ] T004 [US2] 상태 전환 검증 함수 구현: `validateStatusTransition()` in `src/orders/orders.service.ts`
  - `PENDING_PAYMENT` → `PAID`, `CANCELED`, `FAILED` 허용
  - `PAID` → `CANCELED` 허용
  - `CANCELED`, `FAILED` → 변경 불가 검증

---

## Phase 3: User Story 1 - 주문 상태 조회 (Priority: P1) 🎯 MVP

**Goal**: 사용자가 자신의 주문 상태와 결제 정보를 조회할 수 있다.

**Independent Test**: 인증된 사용자가 자신의 주문 ID로 상태 조회 API를 호출하면 주문 상태, 결제 상태, 관련 정보가 반환된다.

### Implementation for User Story 1

- [ ] T005 [US1] Service 메서드 구현: `getStatus(user: User, orderId: string)` in `src/orders/orders.service.ts`
  - 주문 존재 확인 (404)
  - 주문 소유자 검증 (403)
  - 결제 정보 조회 (있으면 포함, 없으면 null)
  - 주문 상태, 결제 상태, 금액, 시각 등 반환
- [ ] T006 [US1] Controller 엔드포인트 추가: `GET /api/orders/:orderId/status` in `src/orders/orders.controller.ts`
  - `@UseGuards(JwtAuthGuard)` 적용
  - `@CurrentUser()` 데코레이터로 사용자 정보 추출
  - `OrdersService.getStatus()` 호출
  - Swagger 문서화 (`@ApiOperation`, `@ApiResponse`)

**Checkpoint**: User Story 1 완료 - 주문 상태 조회 기능이 독립적으로 동작하고 테스트 가능

---

## Phase 4: User Story 2 - 주문 상태 변경 및 결제 정보 동기화 (Priority: P1)

**Goal**: 주문 상태를 변경하고 결제 정보와 일관성을 유지한다.

**Independent Test**: 유효한 주문 ID와 상태 변경 요청에 대해 상태가 정상적으로 업데이트되고, 결제 정보와의 일관성이 유지된다.

### Implementation for User Story 2

- [ ] T007 [US2] 결제 정보 동기화 로직 구현: `syncPaymentStatus()` in `src/orders/orders.service.ts`
  - 주문 상태가 `PAID`로 변경되면 결제 상태도 `PAID`로 동기화
  - 주문 상태가 `CANCELED`로 변경되면 결제 상태도 `CANCELED`로 동기화
  - 결제 정보가 없으면 스킵
- [ ] T008 [US2] Service 메서드 구현: `updateStatus(user: User, orderId: string, status: OrderStatus)` in `src/orders/orders.service.ts`
  - 주문 존재 확인 (404)
  - 주문 소유자 검증 (403)
  - 유효한 상태 전환 검증 (400) - T004의 `validateStatusTransition()` 사용
  - 트랜잭션으로 주문 상태 업데이트
  - 결제 정보 동기화 (T007 로직 사용)
  - `updated_at` 필드 업데이트
  - 업데이트된 정보 반환
- [ ] T009 [US2] Controller 엔드포인트 추가: `PATCH /api/orders/:orderId/status` in `src/orders/orders.controller.ts`
  - `@UseGuards(JwtAuthGuard)` 적용
  - `@CurrentUser()` 데코레이터로 사용자 정보 추출
  - `OrdersService.updateStatus()` 호출
  - Swagger 문서화 (`@ApiOperation`, `@ApiResponse`)

**Checkpoint**: User Story 2 완료 - 주문 상태 변경 및 결제 정보 동기화 기능이 독립적으로 동작하고 테스트 가능

---

## Phase 5: User Story 3 - 주문 상태 수동 변경 (Priority: P2)

**Goal**: 관리자 또는 시스템이 특정 상황에서 주문 상태를 수동으로 변경할 수 있다.

**Independent Test**: 유효한 주문 ID와 상태 변경 요청에 대해 상태가 정상적으로 업데이트되고, 결제 정보와의 일관성이 유지된다.

**Note**: 이 User Story는 User Story 2와 동일한 구현을 공유하므로, User Story 2 완료 시 자동으로 완료됨. 별도 구현 불필요.

---

## Phase 6: Tests

**Purpose**: 단위 테스트 및 통합 테스트 작성

- [ ] T010 [P] [US1] 단위 테스트: `getStatus()` 메서드 테스트 in `src/orders/orders.service.spec.ts`
  - 주문 존재 확인 테스트
  - 주문 소유자 검증 테스트
  - 결제 정보 포함/미포함 케이스 테스트
- [ ] T011 [P] [US2] 단위 테스트: `updateStatus()` 메서드 테스트 in `src/orders/orders.service.spec.ts`
  - 상태 전환 검증 테스트
  - 결제 정보 동기화 테스트
  - 트랜잭션 롤백 테스트
- [ ] T012 [P] [US1] 통합 테스트: `GET /api/orders/:orderId/status` in `tests/playwright/orders.spec.ts`
  - 주문 상태 조회 성공 케이스
  - 주문 소유자가 아닌 사용자 접근 차단 (403)
  - 존재하지 않는 주문 조회 (404)
- [ ] T013 [P] [US2] 통합 테스트: `PATCH /api/orders/:orderId/status` in `tests/playwright/orders.spec.ts`
  - 유효한 상태 변경 성공
  - 유효하지 않은 상태 전환 차단 (400)
  - 주문 소유자가 아닌 사용자 접근 차단 (403)
  - 존재하지 않는 주문 (404)
  - 트랜잭션 롤백 테스트

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 문서화 및 최종 검수

- [ ] T014 [P] Swagger 문서화 완성: 모든 엔드포인트에 `@ApiOperation`, `@ApiResponse` 적용 확인
- [ ] T015 [P] 코드 리뷰 및 린트: `npm run lint` 실행 및 수정
- [ ] T016 [P] 타입 안정성 확인: TypeScript 컴파일 오류 없음 확인
- [ ] T017 [P] 에러 메시지 일관성 확인: 모든 에러 응답이 일관된 형식인지 확인

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User Story 1 (P1) can start after Foundational
  - User Story 2 (P1) depends on User Story 1 completion (상태 전환 검증 로직 공유)
  - User Story 3 (P2) is automatically completed with User Story 2
- **Tests (Phase 6)**: Depends on all user stories being complete
- **Polish (Phase 7)**: Depends on all implementation and tests being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Depends on User Story 1 completion (상태 전환 검증 로직은 Phase 2에서 완료)
- **User Story 3 (P2)**: Automatically completed with User Story 2 (동일한 구현 공유)

### Within Each User Story

- DTOs before Service methods
- Service methods before Controller endpoints
- Core implementation before tests
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks (T001, T002, T003) marked [P] can run in parallel
- Tests for User Story 1 (T010, T012) can run in parallel
- Tests for User Story 2 (T011, T013) can run in parallel
- Polish tasks (T014, T015, T016, T017) can run in parallel

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (DTOs)
2. Complete Phase 2: Foundational (상태 전환 검증)
3. Complete Phase 3: User Story 1 (주문 상태 조회)
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
4. User Story 3 is automatically completed with User Story 2

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1
   - Developer B: Prepare tests for User Story 1
3. Once User Story 1 is done:
   - Developer A: User Story 2
   - Developer B: Tests for User Story 2

---

## Notes

- [P] tasks = different files, no dependencies
- [US1], [US2], [US3] labels map tasks to specific user stories for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- User Story 3는 User Story 2와 동일한 구현을 공유하므로 별도 구현 불필요

