# Tasks: 카카오 간편결제 연동

## Phase 1: 모델/DTO/설계
- [ ] T001 payments 엔티티 확장/확인: tid, amount, status, approved_at, pg_raw 저장
- [ ] T002 DTO: ready(order_id), approve(order_id, pg_token)

## Phase 2: Service (결제 준비/승인)
- [ ] T003 ready: 주문 검증(PENDING_PAYMENT, TIME_CAPSULE, 소유자), 금액 확인, kakao ready 호출 → tid/redirect_url 저장, payment.status=READY
- [ ] T004 approve: tid+pg_token으로 kakao approve 호출, 성공 시 orders.status=PAID, payments.status=PAID/approved_at/pg_raw 반영
- [ ] T005 실패/불일치 처리: 상태 불일치/소유권/타입/금액 mismatch 시 4xx

## Phase 3: Controller/Routes
- [ ] T006 `POST /api/payments/kakao/ready` 연결 (JWT)
- [ ] T007 `POST /api/payments/kakao/approve` 연결 (JWT)

## Phase 4: Tests (e2e)
- [ ] T008 ready 200 → tid/redirect_url 반환
- [ ] T009 approve 200 → order/payment 상태 PAID
- [ ] T010 404: 주문 미존재/소유 불일치/타입 불일치
- [ ] T011 409/400: 상태 PENDING_PAYMENT 아님, pg_token 누락, tid 매칭 불가

