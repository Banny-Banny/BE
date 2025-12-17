# Feature: 카카오 간편결제 연동 (주문 기반 결제 요청)

## 개요
- `orders`에 저장된 주문 정보를 기반으로 카카오페이(간편결제) 결제 요청을 생성하고, 승인 콜백을 처리하는 API.
- 대상 주문: status=PENDING_PAYMENT, product_type=TIME_CAPSULE.
- 결제 프로세스: 결제 준비 → 카카오 결제 페이지 리다이렉트 URL 반환 → 결제 승인 콜백 처리 → 주문/결제 상태 업데이트.

## 목표
- 주문 총액과 옵션을 기반으로 카카오페이 결제 요청을 생성한다.
- 성공/실패/취소 콜백을 처리하여 orders/payment 상태를 갱신한다.
- 사용자 인증 및 주문 소유권을 검증한다.
- **환경 구분**: 기본 mock, 실결제는 `KAKAO_PAY_ENABLE=true` + `KAKAO_PAY_ADMIN_KEY`, `KAKAO_PAY_CID`, `KAKAO_PAY_REDIRECT_BASE` 필요.

## 비범위
- 실제 상품/옵션 변경(재계산) 로직 — 주문 생성 시점의 금액 사용.
- 환불/취소 로직(후속 스펙에서 다룸).
- 포인트/쿠폰/복합 결제.

## 이해관계자 및 액터
- Authenticated User (주문자)
- KakaoPay (PG)
- System (주문 상태 관리, 결제 상태 관리)

## 사용자 시나리오
1. 사용자가 주문 생성(PENDING_PAYMENT) 후 “결제하기”를 누른다.
2. 서버가 카카오페이에 결제 준비 API를 호출하고 redirect_url을 FE에 반환한다.
3. 사용자가 결제 완료 후 카카오 콜백이 서버로 도달한다.
4. 서버는 결제 승인 API를 호출해 성공 시 `orders.status=PAID`, `payments.status=PAID`로 갱신한다.
5. 실패/취소 시 적절한 상태로 업데이트하고 FE에 결과를 반환한다.

## 기능 요구사항 (테스트 가능)
1. **인증 필수**: JWT 필요, 없으면 401.
2. **주문 검증**: 주문 존재, 주문자 일치, status=PENDING_PAYMENT, product_type=TIME_CAPSULE 아니면 404/409.
3. **금액 일치**: 주문에 저장된 total_amount로 카카오 요청, 수정 불가.
4. **PG 연동**:
   - 결제 준비: kakao pay ready API 호출, redirect_url/transaction_id(TID) 저장.
   - 결제 승인: kakao pay approve API 호출, 성공 시 status 갱신.
5. **상태 관리**:
   - 주문: PENDING_PAYMENT → PAID (승인), FAIL(승인 실패), CANCELED(사용자 취소)
   - 결제: READY → PAID/FAILED/CANCELED
6. **보안/검증**:
   - 콜백 시 order_id, TID 매칭 검증.
   - 요청자=주문자 검증 (ready 요청 시).
7. **응답**:
   - 준비 API: redirect_url, tid, order_id 반환.
   - 승인 API: 결제 결과(승인금액/주문정보) 반환.

## API 초안
- `POST /api/payments/kakao/ready`
  - Auth: Bearer JWT
  - Body: `order_id` (uuid)
  - Flow: 주문 검증 → kakao ready 호출 → TID/redirect_url 반환, payment status=READY 저장
  - 201: `{ order_id, tid, redirect_url }`
  - 400/401/404/409: 검증 실패/상태 불일치

- `POST /api/payments/kakao/approve`
  - Auth: Bearer JWT
  - Body: `{ order_id, pg_token }` (카카오 콜백 파라미터)
  - Flow: TID/order 매칭 → kakao approve 호출 → 성공 시 orders.status=PAID, payments.status=PAID
  - 201: `{ order_id, status: 'PAID', approved_at, amount }`
  - 400/401/404/409: 검증/상태 불일치

- (옵션) `POST /api/payments/kakao/cancel` (후속 스펙에서 환불 처리)

## 데이터 모델 참고 (확장)
- `payments`:
  - order_id (fk), tid (kakao TID), status (READY/PAID/FAILED/CANCELED), amount, approved_at, pg_raw
- `orders`:
  - status: PENDING_PAYMENT → PAID/FAILED/CANCELED

## 성공 기준
- 유효한 주문/사용자에 대해 kakao ready 요청이 성공하고 redirect_url/tid를 반환.
- 승인 콜백 시 상태가 PAID로 갱신.
- 잘못된 상태/주문/사용자는 적절히 4xx 응답으로 거절.
- 중복 ready/approve 요청에 대한 idempotency/오류 응답이 명확하다(PAYMENT_ALREADY_READY_OR_PAID, ORDER_ALREADY_PAID 등).

## 가정 / 메모
- 카카오 테스트 키/상점정보는 .env로 주입(KAKAO_PAY_*), 실결제는 `KAKAO_PAY_ENABLE=true` 필요.
- 주문 금액은 주문 생성 시 확정된 total_amount를 사용.
- 결제 취소/환불, 영수증/세금계산서 발행은 별도 스펙에서 다룸.
- ready 중복 시 READY/PAID 상태면 거절(409)하여 TID 덮어쓰기 방지.

