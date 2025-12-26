# Feature: 토스페이먼츠 결제 연동 및 데이터 모델 확장

**목표**  
- 토스페이먼츠 결제 승인/취소/조회 API를 백엔드에 연동하고, 결제 응답의 핵심 식별자·정산/취소 이력·영수증/빌링 정보를 영구 저장한다.  
- 결제 완료 시 기존 로직(주문 상태 PAID 전환 및 타임캡슐 생성)과 연동하며, React Native Expo 프런트엔드가 필요한 결제 정보(Payment 객체, Cancel 기록)를 API로 조회할 수 있게 한다.

## 사용자 시나리오 (우선순위)
- **P1: 결제 승인/정산 흐름**  
  - 사용자가 모바일 앱(React Native Expo)에서 결제를 완료하면 백엔드가 토스 `payments/confirm`으로 승인 → 주문 상태를 `PAID`로 바꾸고, 결제 키/주문 번호/결제 금액/영수증 URL/정산 상태 등을 저장한다.  
  - 이미 기존 로직에 따라 캡슐 자동 생성이 실행된다.
- **P1: 결제 조회**  
  - 프런트가 `paymentKey` 또는 `orderId`로 결제 상세를 조회하면 저장된 Payment 객체(토스 응답 주요 필드 + 취소 이력)와 내부 주문/캡슐 연결 상태를 확인한다.
- **P1: 결제 취소**  
  - 사용자가 취소 요청 시 `payments/{paymentKey}/cancel` 호출 → 백엔드가 토스에 취소 요청 후, 취소 이력(부분 취소 포함)을 DB에 누적하고 주문/캡슐 상태를 조정한다.
- **P2: 가상계좌/빌링**  
  - 가상계좌 발급/입금 완료 조회를 저장하고, 필요 시 빌링키 기반 자동결제를 위한 Billing 객체를 저장한다.
- **P3: 프로모션/정산/거래 조회**  
  - 카드 할인·무이자 프로모션/거래/정산 내역을 조회 API로 프런트에 전달하거나 운영 툴에서 확인할 수 있게 준비한다.

## 데이터 모델 확장 (필수 컬럼)
> 토스 Payment 응답의 핵심 식별자/금액/상태/취소 이력/영수증 URL을 보존해야 함.

- `payments` 테이블 (신규 컬럼)
  - `payment_key` (string, unique, not null): 토스 `paymentKey` 저장
  - `order_id` (uuid, FK→orders, unique): 기존 유지
  - `order_no` (string, not null): 토스에 전달한 `orderId` (프런트/토스 동기화용)
  - `order_name` (string, nullable): 토스 `orderName`
  - `method` (string, nullable): 결제수단 (카드/가상계좌/간편결제 등)
  - `status` (enum or string): READY/IN_PROGRESS/DONE/CANCELED/PARTIAL_CANCELED/ABORTED/EXPIRED
  - `currency` (string, default KRW)
  - `balance_amount` (int, nullable): 잔여 취소 가능 금액
  - `total_amount` (int, not null): 결제 총액 (`totalAmount`)
  - `vat` (int, nullable), `tax_free_amount` (int, nullable), `supplied_amount` (int, nullable), `tax_exemption_amount` (int, nullable)
  - `requested_at` (timestamptz), `approved_at` (timestamptz, nullable)
  - `receipt_url` (string, nullable)
  - `last_transaction_key` (string, nullable)
  - `card_type` / `issuer_code` / `acquirer_code` / `installment_plan_months` / `is_interest_free` (nullable): 카드 필드 요약
  - `easy_pay_provider` (string, nullable)
  - `virtual_account` jsonb (nullable): accountNumber, bankCode, customerName, dueDate, refundStatus 등
  - `fail_code` / `fail_message` (nullable): 승인 실패 시
  - `raw_response` jsonb: 토스 Payment 원문 보관 (감사/디버깅)

- `payment_cancels` 테이블 (신규)
  - `id` (uuid pk)
  - `payment_id` (FK→payments)
  - `transaction_key` (string, unique)
  - `cancel_amount` (int)
  - `cancel_reason` (string)
  - `cancel_status` (string) — DONE 등
  - `canceled_at` (timestamptz)
  - `tax_free_amount` (int, nullable)
  - `tax_exemption_amount` (int, nullable)
  - `receipt_key` (string, nullable)
  - `refundable_amount` (int, nullable)
  - `easy_pay_discount_amount` / `transfer_discount_amount` (int, nullable)
  - `raw_response` jsonb

- `billing_keys` (선택: 자동결제 대비)
  - `billing_key` (string, pk)
  - `customer_key` (string)
  - `method` (string)
  - `card_meta` jsonb (issuerCode, acquirerCode, number, cardType, ownerType 등)
  - `authenticated_at` (timestamptz)
  - `status` (string)

- 주문/캡슐 연계 영향도: 기존 `orders` ↔ `payments` 1:1, `orders` ↔ `capsules` 1:1 유지. 토스 `orderId`는 주문 id(UUID)와 별도 관리 필요.

## API 범위 (초안)
- `POST /api/payments/toss/confirm` : `paymentKey`, `orderId`, `amount`으로 승인 후 Payment 저장, 주문 상태 `PAID`, 캡슐 생성 호출.
- `GET /api/payments/toss/:paymentKey` : 저장된 Payment + 취소 이력 반환.
- `GET /api/payments/toss/orders/:orderId` : 주문번호 기준 조회.
- `POST /api/payments/toss/:paymentKey/cancel` : 부분/전체 취소, 취소 이력 적재, 주문/캡슐 상태 조정.
- (옵션) `POST /api/payments/toss/virtual-accounts` : 가상계좌 발급 후 Payment 저장.
- (옵션) `POST /api/payments/toss/billing/issue` + `POST /api/payments/toss/billing/:billingKey` : 자동결제 등록/승인.
- (운영용) 프로모션/거래/정산 조회 API 패스스루.

## 성공 기준
- 토스 `paymentKey`, `orderId`, 금액, 상태, 영수증 URL, 취소 이력이 DB에 저장되고 조회 API로 노출된다.
- 결제 승인 시 주문 상태가 `PAID`로 업데이트되고 캡슐 자동 생성이 유지된다.
- 결제 취소 시 취소 이력이 누적되고 주문/캡슐 정합성이 유지된다.
- 프런트(React Native Expo)가 `paymentKey`/`orderId` 기반으로 Payment 상세를 조회해 UI를 복원할 수 있다.

