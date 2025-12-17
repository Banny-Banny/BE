# Plan: 타임캡슐 주문(결제 전) 생성 및 금액 계산

## 1. 목표
- TIME_CAPSULE 상품을 선택해 주문 생성(결제 전 단계) 및 총액 계산.
- 옵션: 열람 시점(1주/1달/1년/커스텀), 인원(1~10), 사진(장당 500원, 총 사진 ≤ 인원*5), 추가 옵션(배경음악 1000원, 동영상 2000원).
- 결과: order에 옵션/금액 저장, 상태 PENDING_PAYMENT.

## 2. 인풋 & 의존성
- spec: `specs/004-order-checkout/spec.md`
- 엔티티: orders(신규 필요), products (TYPE=TIME_CAPSULE), users
- 인증: JwtAuthGuard

## 3. 범위
- 포함: 주문 생성 API, 옵션 검증, 금액 계산, order 저장, 응답 반환.
- 제외: 실제 결제/payment 연동, 쿠폰/포인트, 배송.

## 4. 설계 결정 (초안)
- Endpoint: `POST /api/orders`
- DTO:
  - product_id (uuid, required, TIME_CAPSULE & is_active)
  - time_option: 1_WEEK | 1_MONTH | 1_YEAR | CUSTOM
  - custom_open_at: required if CUSTOM, must be future
  - headcount: 1~10
  - photo_count: default 0, max headcount*5
  - add_music?: bool
  - add_video?: bool
- 가격 정책:
  - base: 1_WEEK = 1000 (다른 옵션은 정책 확장 여지, 일단 동일 베이스 적용)
  - photo: 500 * photo_count
  - music: +1000 if add_music
  - video: +2000 if add_video
- 권한/업로드: 음악/동영상은 구매자만 업로드 가능 (주문 생성 시 flag로만 저장, 업로드는 결제 후 단계에서 검증).
- 저장: orders 테이블에 옵션/총액/상태(PENDING_PAYMENT) 저장.

## 5. 데이터 모델 영향 (제안)
- `orders` (신규):
  - id (uuid), user_id, product_id
  - time_option (enum), custom_open_at (nullable)
  - headcount (int), photo_count (int)
  - add_music (bool), add_video (bool)
  - total_amount (int)
  - status (enum: PENDING_PAYMENT, etc.)
  - created_at, updated_at
- 마이그레이션 필요: orders 테이블 + status enum + time_option enum.

## 6. API 설계 (초안)
- `POST /api/orders`
  - Auth: Bearer JWT
  - Body: product_id, time_option, custom_open_at?, headcount, photo_count, add_music?, add_video?
  - Responses:
    - 201: { order_id, total_amount, time_option, custom_open_at?, headcount, photo_count, add_music, add_video, status }
    - 400: 옵션/범위/시간 검증 실패
    - 401: 인증 실패
    - 404: product 미존재/비활성 or 타입 불일치

## 7. 비즈니스 규칙/검증
- product: 존재, is_active=true, product_type=TIME_CAPSULE
- time_option: enum, CUSTOM이면 custom_open_at 미래
- headcount: 1~10
- photo_count: 0 이상, ≤ headcount*5
- 금액: base(1000) + photo_count*500 + (add_music?1000:0) + (add_video?2000:0)
- status: PENDING_PAYMENT 저장

## 8. 에러 코드 가이드
- 400: 옵션 검증 실패 (범위/시간/타입)
- 401: 인증 실패
- 404: product 미존재/비활성/타입 불일치

## 9. 테스트 전략
- 201: 정상 주문 생성, 총액 계산 검증 (music/video/photo/headcount 조합)
- 400: headcount 초과, photo_count > headcount*5, 커스텀 시점 과거
- 404: 존재하지 않거나 TIME_CAPSULE이 아닌 product_id

## 10. 작업 개요 (tasks로 세분화 예정)
- DTO/enum 정의, orders 엔티티/마이그레이션, Service 계산/검증, Controller, 테스트(e2e), Swagger 문서.

