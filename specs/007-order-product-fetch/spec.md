# Feature: 주문 상세 조회 & 상품 제약 조회 API

## 개요
- 결제/대기방 단계에서 주문에 담긴 옵션(인원, 사진 수, 음악/동영상 선택)과 연관 상품의 제약(max_media_count, media_types 등)을 재표시하기 위한 조회 API를 추가한다.
- 기존에는 `POST /orders` 생성 응답만으로 값을 보관해야 했으나, 재진입 시점을 대비해 서버 조회 경로가 필요하다.

## 목표
- 주문 ID로 주문 상세를 조회해 옵션과 금액, 상태를 확인할 수 있다.
- 주문이 참조하는 상품 정보(활성 여부, 타입, 미디어 제약)를 함께 제공한다.

## 비범위
- 주문 생성/수정, 결제 승인/취소 로직 변경은 포함하지 않는다.
- 상품 생성/수정 API는 포함하지 않는다(조회만 제공).

## 이해관계자 및 액터
- Authenticated User (주문자)
- System (주문/상품 조회, 소유권·상태 검증)

## 사용자 시나리오
1. 사용자가 이전에 생성한 `order_id`를 이용해 대기방으로 재진입한다.
2. 클라이언트가 `GET /orders/:id`로 주문 옵션과 상태, 금액을 받아 UI를 복원한다.
3. 필요 시 상품 제약 정보도 함께 받아 사진/음악/영상 UI를 조건부로 렌더링한다.

## 기능 요구사항 (테스트 가능)
1. **인증 필수**: Bearer JWT 없으면 401.
2. **소유권 검증**: 주문 `user_id`와 현재 사용자 불일치 시 403.
3. **주문 상태**: 삭제/미존재면 404. (상태는 `PENDING_PAYMENT` 등 그대로 반환)
4. **상품 검증**: 연관 상품이 비활성화거나 타입 불일치 시 404(`PRODUCT_NOT_FOUND_OR_INVALID`).
5. **응답 필드 - 주문**:
   - `order_id`, `status`, `total_amount`, `time_option`, `custom_open_at?`
   - `headcount`, `photo_count`, `add_music`, `add_video`
   - `created_at`, `updated_at?`
6. **응답 필드 - 상품**:
   - `id`, `product_type`, `name`, `price`, `is_active`
   - `max_media_count`, `media_types`
7. **에러 코드 예시**:
   - 401: `UNAUTHORIZED`
   - 403: `ORDER_NOT_OWNED`
   - 404: `ORDER_NOT_FOUND`, `PRODUCT_NOT_FOUND_OR_INVALID`

## API 초안
- `GET /api/orders/:id`
  - Auth: Bearer JWT
  - Path: `id` (uuid)
  - Responses:
    - 200:
      - `order`: `{ order_id, status, total_amount, time_option, custom_open_at?, headcount, photo_count, add_music, add_video, created_at, updated_at? }`
      - `product`: `{ id, product_type, name, price, is_active, max_media_count, media_types }`
    - 401/403/404: 위 요구사항에 따른 에러 코드/메시지

## 데이터 모델 참고
- `orders`: 기존 필드 활용 (`headcount`, `photo_count`, `add_music`, `add_video`, `time_option`, `custom_open_at`, `total_amount`, `status`, timestamps)
- `products`: `product_type`, `is_active`, `max_media_count`, `media_types`, `price`, `name`

## 성공 기준
- 자신의 주문 ID로 조회 시 200과 함께 주문 옵션·금액·상태가 반환된다.
- 비소유 주문 접근 시 403, 미존재/비활성 상품일 경우 404가 반환된다.
- 응답에 상품 제약 정보가 포함돼 클라이언트가 미디어 UI를 조건부 렌더링할 수 있다.

