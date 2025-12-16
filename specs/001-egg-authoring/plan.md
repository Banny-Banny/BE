# Plan: 이스터에그 작성 API (다중 미디어/소모형 캡슐)

## 1. 목표
- 이스터에그(캡슐) 작성 API 제공 (`POST /api/capsules`)
- 최대 3개의 미디어 업로드/저장 지원 (null 허용)
- 사용자 작성 슬롯 3개 유지: 생성 시 1개 소모, view_limit 소진 시 1개 회복

## 2. 인풋 & 의존성
- spec: `specs/001-egg-authoring/spec.md`
- 엔티티: `users`, `products`, `capsules`, `capsule_access_logs`
- 기존 enum: `MediaType` (TEXT/IMAGE/VIDEO/MUSIC)
- 상품: `products.productType`, `mediaTypes (array|null)`, `maxMediaCount (0~3 | null)`, Check 제약

## 3. 범위
- 포함: 캡슐 생성, 검증, 슬롯 차감/부여 로직, 다중 미디어 저장, Swagger 문서
- 제외: 업로드 API, 조회/개봉 로직, 알림/결제, 슬롯 회복 트리거(뷰 로직 내 구현은 추후)

## 4. 아키텍처/설계 결정
- Controller: `CapsulesController` (`POST /api/capsules`) with JWT guard
- Service: `CapsulesService` 트랜잭션으로 슬롯 차감 + 캡슐 생성
- Validation: class-validator DTO (배열 길이 0~3, media_types enum, media_urls nullable)
- Data 저장:
  - `capsules.media_urls` : text[] (nullable, length<=3)
  - `capsules.media_types`: enum[] (MediaType, nullable, length<=3)
  - Check 제약: array_length(media_urls,1)<=3, array_length(media_types,1)<=3
  - view_limit default 0, view_count default 0
- 슬롯 관리:
  - users 테이블에 `egg_slots` int default 3 (간단/즉시 적용)  
    - 생성 시 `egg_slots > 0` 확인 후 1 감소 (트랜잭션)  
    - view_limit 소진 시 회복은 추후 조회/개봉 로직에서 처리
- 상품 정책:
  - productType = EASTER_EGG → `max_media_count`(0~3) 존중, `media_types` 허용 목록 검사
  - productType != EASTER_EGG → 미디어 개수/타입 제약 없음 (단 글로벌 3개 한도는 유지)

## 5. 데이터 모델 변경 (마이그레이션)
- `products` (이미 수정됨)
  - product_type enum, media_types text[] enum, max_media_count int (nullable), Check 제약
- `users`
  - `egg_slots` int NOT NULL DEFAULT 3
- `capsules`
  - `media_urls` text[] NULL
  - `media_types` MediaType[] NULL
  - CHECK array_length(media_urls,1)<=3, array_length(media_types,1)<=3

## 6. API 설계 (초안)
- `POST /api/capsules`
  - Auth: Bearer JWT
  - Body:
    - title (string, required, <=500)
    - content (string, optional, <=500)
    - latitude, longitude (number, optional)
    - media_urls: string[] length 0~3 (nullable entries)
    - media_types: MediaType[] length 0~3 (첫 슬롯 기본 TEXT, 나머지 null 허용)
    - open_at: datetime (optional, must be future)
    - view_limit: int (default 0, >=0)
    - product_id: uuid (optional)
  - Responses:
    - 201: { id, title, open_at, is_locked, view_limit, media_types[], media_urls[] }
    - 400: 검증 실패 (길이/타입/미디어-URL 매핑/과거 open_at/음수 view_limit)
    - 401: 인증 실패
    - 404: product_id 없음
    - 409: egg_slots 부족

## 7. 비즈니스 규칙/검증 로직
- 슬롯: egg_slots <= 0 → 409, 아니면 egg_slots -=1 (TX)
- view_limit: null → 0, 음수 금지
- open_at: 과거면 400, 없으면 is_locked = true
- media:
  - 길이 0~3, types와 urls 인덱스 매칭
  - type != TEXT → 해당 index url 필요
  - productType=EASTER_EGG → media 개수 <= product.max_media_count, type 허용 목록 검사
- product 존재 시만 연동, 없으면 404

## 8. 에러 코드 가이드
- 400: DTO 검증 실패, open_at 과거, 음수 view_limit, media/url 불일치, product 정책 위반
- 401: 인증 실패
- 404: product_id 미존재
- 409: egg_slots 부족

## 9. 보안/기타
- JWT Guard 필수
- Swagger Bearer 설정 (`access-token`)
- CORS 기존 설정 유지

## 10. 테스트 전략
- 유닛: DTO 검증 (길이/enum/미디어 매핑), 슬롯 차감 서비스 로직, product 정책 적용
- 통합: POST /api/capsules
  - 슬롯 부족 409
  - open_at 과거 400
  - media_types!=TEXT인데 url 없음 400
  - product EASTER_EGG, max_media_count 초과 400
  - 정상 201 후 DB 확인 (media 배열, user egg_slots 감소)

## 11. 작업 개요 (추후 tasks.md에 상세 분해)
- 마이그레이션: users.egg_slots, capsules.media_urls/media_types check
- DTO/Controller/Service 신규 추가 (Capsules)
- product 정책 검증 유틸 추가
- Swagger 문서 업데이트
- e2e 테스트 케이스 추가

