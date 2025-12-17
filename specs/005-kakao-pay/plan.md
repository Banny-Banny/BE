# Plan: 카카오 간편결제 연동 (주문 기반 결제 요청)

## 1. 목표
- PENDING_PAYMENT 상태의 TIME_CAPSULE 주문을 기반으로 카카오페이 결제 준비/승인을 처리한다.
- ready API로 redirect_url/tid 반환, approve API로 승인/상태 업데이트.

## 2. 인풋 & 의존성
- spec: `specs/005-kakao-pay/spec.md`
- 엔티티: orders (status, total_amount, product_id, user_id), payments (tid, status, amount)
- 외부: Kakao Pay REST API (ready/approve), .env에 KAKAO_PAY_* 설정 필요
- 인증: JwtAuthGuard

## 3. 범위
- 포함: ready/approve 엔드포인트, 주문/결제 상태 검증 및 갱신, TID 저장, 금액 검증.
- 제외: 환불/취소, 포인트/쿠폰, 결제 금액 수정, 영수증/세금계산서.

## 4. 설계 결정 (초안)
- Endpoint:
  - `POST /api/payments/kakao/ready`
  - `POST /api/payments/kakao/approve`
- 주문 조건: status=PENDING_PAYMENT, product_type=TIME_CAPSULE, 주문자=요청자
- 금액: orders.total_amount 그대로 사용 (재계산 없음)
- 상태 전환:
  - order: PENDING_PAYMENT → PAID / FAILED
  - payment: READY → PAID / FAILED
- 저장:
  - payment.tid, amount, status, approved_at, raw response 저장

## 5. 데이터 모델 영향 (제안)
- payments 테이블에 tid, amount, status, approved_at, pg_raw 추가/확인
- orders.status 사용 (이미 enum에 PENDING_PAYMENT/PAID/FAILED 포함)

## 6. API 설계 (초안)
- ready: Body { order_id }, Auth required, **응답 201**
  - 검증: 주문 존재/소유자/상태/타입, 금액, **READY/PAID 중복 ready 거절(409)**
  - PG 호출 후 tid/redirect_url 반환, payment.status=READY, order.status 유지
- approve: Body { order_id, pg_token }, Auth required, **응답 201**
  - 검증: 주문자/상태/타입, payment.tid 존재, 이미 PAID면 거절(400/409)
  - PG 승인 호출, 성공 시 order.status=PAID, payment.status=PAID

## 7. 비즈니스 규칙/검증
- 주문자=현재 사용자
- status=PENDING_PAYMENT
- product_type=TIME_CAPSULE
- amount 일치 (PG에 전달 시 orders.total_amount 사용)
- approve 시 tid + pg_token 필수

## 8. 에러 코드 가이드
- 400: 잘못된 상태/파라미터/금액 불일치
- 401: 인증 실패
- 404: 주문 미존재/소유권 불일치/타입 불일치
- 409: 이미 처리된 주문/결제

## 9. 테스트 전략
- ready 200: 정상 주문, tid/redirect_url 반환
- approve 200: ready 후 pg_token으로 승인 → status PAID 반영
- 404: 주문자 불일치, 타입 불일치, 미존재
- 409: 이미 PAID 상태에서 ready/approve 요청
- 400: PENDING_PAYMENT 아님, pg_token 누락, tid 매칭 불가

## 10. 작업 개요 (tasks로 세분화 예정)
- DTO/검증, service에서 주문/금액 검증 및 PG 연동, payment 엔티티 저장, controller wiring, e2e 테스트.

