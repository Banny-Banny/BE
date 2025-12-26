# Implementation Plan: 토스페이먼츠 결제 연동

**Branch**: `009-toss-payments-integration` | **Date**: 2025-12-26 | **Spec**: `specs/009-toss-payments-integration/spec.md`

## Summary
- 토스 결제 승인/취소/조회 API를 연동하여 Payment 객체 주요 필드와 취소 이력을 저장한다.
- 결제 성공 시 주문 상태를 `PAID`로 전환하고 기존 캡슐 자동 생성 흐름을 유지한다.
- 프런트(React Native Expo)가 `paymentKey`/`orderId`로 Payment 상세를 조회할 수 있게 한다.

## Technical Context
- Stack: NestJS + TypeORM + PostgreSQL
- 기존 흐름: `PaymentsService`가 카카오 mock 승인 → 주문 상태 `PAID` → `createFromPaidOrder` 호출
- 신규: 토스 API 호출(REST, Basic Auth), Payment 응답 매핑 및 취소 이력 저장

## Plan / Steps
1) **DB 마이그레이션 설계**
   - **통합 유지**: `payments` 테이블 확장으로 대부분 흡수  
     - 필수 컬럼: `payment_key`(unique), `order_no`, `order_name`, `toss_status`(string), `method`, `currency`, `balance_amount`, `total_amount`, `vat`, `tax_free_amount`, `supplied_amount`, `tax_exemption_amount`, `requested_at`, `approved_at`, `receipt_url`, `last_transaction_key`, `easy_pay_provider`, `card_meta`(jsonb), `virtual_account`(jsonb), `fail_code`, `fail_message`, `raw_response`(기존 pgRaw 활용).
     - 기존 `PaymentStatus` enum은 내부용으로 유지, 토스 상태는 `toss_status` 문자열로 저장.
   - **반드시 분리**: `payment_cancels` 테이블 (부분/다건 취소 이력용)  
     - `payment_id` FK, `transaction_key`(unique), `cancel_amount`, `cancel_reason`, `cancel_status`, `canceled_at`, `tax_free_amount`, `tax_exemption_amount`, `refundable_amount`, `easy_pay_discount_amount`, `transfer_discount_amount`, `receipt_key`, `raw_response`.
   - (옵션) `billing_keys` 테이블: 자동결제 필요 시만 추가 (`billing_key`, `customer_key`, `method`, `card_meta`, `authenticated_at`, `status`).
2) **엔티티/모듈 확장**
   - `Payment` 엔티티에 신규 컬럼 반영, `PaymentCancel` 엔티티 추가, `BillingKey` 엔티티 (옵션).
   - TypeORM 관계 설정 (`payments` 1:N `payment_cancels`).
3) **토스 API 클라이언트**
   - 환경변수: `TOSS_SECRET_KEY`, `TOSS_BASE_URL`(기본 https://api.tosspayments.com), 타임아웃/에러 핸들링.
   - 메서드: `confirm(paymentKey, orderId, amount)`, `getByPaymentKey`, `getByOrderId`, `cancel(paymentKey, payload)`, (옵션) `createVirtualAccount`, `issueBillingKey`, `billingPay`.
4) **도메인 로직 적용**
   - 승인: 토스 응답 → Payment 저장/업데이트 → 주문 상태 `PAID` → `createFromPaidOrder(order.id)` 호출.
   - 취소: 토스 취소 응답 → `payment_cancels` 적재 → 주문/캡슐 상태 조정(정책 정의: 전액 취소 시 주문 `CANCELED` + 캡슐 처리 TBD).
   - 조회: 저장된 Payment + 취소 이력 반환.
5) **컨트롤러/DTO**
   - `POST /api/payments/toss/confirm` (payload: `paymentKey`, `orderId`, `amount`).
   - `GET /api/payments/toss/:paymentKey`
   - `GET /api/payments/toss/orders/:orderId`
   - `POST /api/payments/toss/:paymentKey/cancel` (cancelReason, cancelAmount?, refund account for VA)
   - Swagger 스키마 업데이트.
6) **테스트**
   - 단위: 토스 클라이언트 mock, 매퍼 검증, 취소 이력 적재, 상태 전환.
   - 통합: 승인 → 주문 PAID → 캡슐 생성 → 조회로 필드 확인; 취소 → 취소 이력 확인.
   - Playwright: 결제 승인 mock 시나리오 확장(결제키 주입), 취소 시나리오 추가.
7) **운영/보안**
   - 시크릿 키 Base64 Basic Auth 헤더 처리, 로그에 민감정보 마스킹.
   - 에러 코드 매핑(토스 failure → 4xx/5xx), 멱등 처리(취소 시 키 중복 방지).

## Risks / Checks
- 토스 금액/통화와 주문 금액 불일치 시 오류 처리.
- 부분 취소 시 주문/캡슐 상태 정의 필요.
- 가상계좌 입금 웹훅이 필요하면 추가 설계 필요(현재 범위 밖).

## Deliverables
- 마이그레이션 스크립트
- 엔티티/서비스/컨트롤러/DTO 업데이트
- 통합/Playwright 테스트 케이스
- Swagger 문서 반영

