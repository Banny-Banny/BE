# Implementation Plan: 캡슐 스키마 분리 및 유저 name 컬럼

## Architecture / Approach

- `Capsule`는 공통 데이터만 보유하고 `capsule_type`으로 타입 식별
- 타입별 데이터는 `TimeCapsule`/`EasterEgg` 1:1 테이블로 분리
- 결제 기반 타임캡슐은 `Order`와 1:1로 연결하고 `product`는 `order.product`로 참조
- 기존 API 응답 구조 유지: 서비스 레이어에서 기존 DTO를 그대로 매핑

## Data Model Changes

- `capsules`:
  - 추가: `capsule_type` (TIME_CAPSULE | EASTER_EGG)
  - 제거: `product_id`, `order_id`, `open_at`, `is_locked`, `view_limit`, `view_count`,
    `invite_code`, `deadline`, `room_status`, `buried_at`, `is_auto_submitted`
- `time_capsules` (신규):
  - `capsule_id` (PK, FK to `capsules`)
  - `order_id` (unique, FK to `orders`)
  - `open_at`, `is_locked`, `invite_code`, `deadline`, `room_status`,
    `buried_at`, `is_auto_submitted`
- `easter_eggs` (신규):
  - `capsule_id` (PK, FK to `capsules`)
  - `product_id` (nullable, FK to `products`)
  - `view_limit`, `view_count`
- `users`:
  - 추가: `name` (nullable)

## API Surface

- 기존 캡슐/대기실/주문 API 유지
- 내부 조회/생성 로직만 변경

## Risks & Mitigations

- 데이터 마이그레이션 오류: 타입 판별 로직을 명시하고 사전 백업 가이드 포함
- 쿼리 변경 범위 큼: 관련 서비스/DTO 단위로 단계적 수정
