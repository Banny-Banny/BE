# Feature: 타임캡슐 주문(결제 전) 생성 및 금액 계산

## 개요
- 타임캡슐 상품을 선택해 주문서를 생성하고, 결제 이전 단계까지 금액을 계산/검증하는 API.
- 상품 유형: TIME_CAPSULE (product)
- 옵션 선택: 열람 시점(1주/1달/1년/직접입력), 인원수(최대 10명), 사진(장당 500원, 1인당 최대 5장), 추가 옵션(배경음악 1000원, 동영상 2000원) — 음악/동영상은 구매자만 업로드 가능.

## 목표
- 주문 생성 시 옵션 검증 및 총액 산출.
- 결제 단계로 넘기기 전에 order에 총액/옵션을 저장.
- 구매자 이외 사용자는 사진+텍스트만 가능하도록 제약.

## 비범위
- 실제 결제 처리(payment) 및 PG 연동.
- 배송/쿠폰/포인트 등 추가 결제 옵션.

## 이해관계자 및 액터
- Authenticated User (구매자)
- System (상품/옵션 검증, 금액 계산, 주문 생성)

## 사용자 시나리오
1. 사용자 로그인 후 TIME_CAPSULE 상품을 선택한다.
2. 열람 시점 옵션(1주/1달/1년/직접입력) 중 하나를 고른다.
3. 최대 인원(1~10명)을 지정한다.
4. 사진 개수를 선택한다(장당 500원, 1인당 최대 5장 제한에 따라 총 허용 사진 수 계산).
5. 추가 옵션으로 배경음악(1000원), 동영상(2000원)을 선택할 수 있다(구매자만 업로드 가능).
6. 서버가 금액을 계산해 주문서를 생성하고 order에 저장한다.
7. 응답에는 주문 id, 계산된 총액, 선택 옵션이 포함된다. 이후 결제 단계에서 payment로 전달한다.

## 기능 요구사항 (테스트 가능)
1. **인증 필수**: JWT 필요, 없으면 401.
2. **상품 검증**: product_type=TIME_CAPSULE이어야 하며 활성 상품만 주문 가능. 없으면 404.
3. **열람 시점 옵션**: `time_option` ∈ {`1_WEEK`, `1_MONTH`, `1_YEAR`, `CUSTOM`}. CUSTOM이면 `custom_open_at` 필수이며 미래 시각이어야 한다.
4. **인원수**: 1~10 사이 정수. 범위 밖이면 400.
5. **사진**:
   - 사진 단가 500원.
   - 1인당 최대 5장 → 총 사진 수 ≤ 인원수 * 5. 초과 시 400.
6. **추가 옵션**:
   - 배경음악: 1000원. 구매자만 업로드 가능.
   - 동영상: 2000원. 구매자만 업로드 가능.
7. **기본 상품가**: 1주 뒤 1000원(1주 옵션 선택 시 기본가 1000). 1달/1년/CUSTOM의 기본가는 명시적 요구 없음 → 1주 기본가를 baseline으로 사용(추가 정책 필요 시 확장). 
8. **총액 계산**:
   - 기본가(옵션에 따른) + (사진 개수 * 500) + (배경음악 선택 시 1000) + (동영상 선택 시 2000).
9. **저장**: order 테이블(또는 orders 엔티티)에 옵션과 금액을 저장하고 상태는 “PENDING_PAYMENT” 등으로 설정.
10. **응답**: 201에 주문 정보 반환 `{ order_id, total_amount, time_option, custom_open_at?, headcount, photo_count, allow_music, allow_video }`.
11. **권한 제약**: 구매자만 음악/동영상 업로드 가능. 비구매자에겐 사진/텍스트만 허용.

## API 초안
- `POST /api/orders`
  - Auth: Bearer JWT
  - Body:
    - `product_id` (uuid, required, TIME_CAPSULE)
    - `time_option` (`1_WEEK`|`1_MONTH`|`1_YEAR`|`CUSTOM`, required)
    - `custom_open_at` (datetime, required if CUSTOM, future)
    - `headcount` (int, 1~10, required)
    - `photo_count` (int, default 0, max = headcount * 5)
    - `add_music` (bool, optional)
    - `add_video` (bool, optional)
  - Responses:
    - 201: `{ order_id, total_amount, time_option, custom_open_at?, headcount, photo_count, add_music, add_video }`
    - 400: 검증 실패 (범위 초과, 시간 과거, 타입 오류)
    - 401: 인증 실패
    - 404: product 미존재/비활성

## 데이터 모델 참고 (초안)
- `orders`:
  - id, user_id, product_id
  - time_option, custom_open_at
  - headcount, photo_count, add_music, add_video
  - total_amount, status (PENDING_PAYMENT)
  - created_at, updated_at
- `products`: product_type=TIME_CAPSULE, is_active

## 성공 기준
- 유효한 요청에 대해 201과 함께 계산된 총액/옵션을 반환.
- 사진 수, 인원수, 시간 옵션, 추가 옵션 검증이 정확히 동작.
- 비활성/타입 불일치 상품은 404 처리.

## 가정 / 메모
- 기본가: 1주 옵션 1000원을 기본가로 적용. 1달/1년/custom의 기본가 정책이 추가되면 확장 필요.
- 음악/동영상은 구매자만 업로드 가능. 서버에서 업로더=요청자 검증.
- 사진 단가 500원(요구사항에 “장당 500원” 언급, 상단 “사진은 한 장당 300원” 문구는 모순 → 최신 값 500원으로 정리). 필요 시 단가를 product 정책으로 분리 가능.

