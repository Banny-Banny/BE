# Plan: 이스터에그 위치 기반 목록 API

## 1. 목표
- `GET /api/capsules`로 반경/지도 뷰 내 접근 가능한 이스터에그 목록을 반환.
- 친구 관계 + 위치 반경을 모두 만족하는 캡슐만 노출하고, open_at/view_limit 정보를 함께 내려 FE가 즉시 개봉 가능 여부를 판단.

## 2. 인풋 & 의존성
- spec: `specs/003-egg-map-display/spec.md`
- 엔티티: capsules, friendships, products
- 인증: JwtAuthGuard
- 거리 계산: Haversine 또는 DB 함수(ST_DWithin 대체)로 meter 단위 계산

## 3. 범위
- 포함: 위치/친구 필터, 반경/limit 유효성 검증, consumed 캡슐 기본 제외, is_locked 계산, product 동봉, 커서 페이징
- 제외: 개별 상세 조회, 슬롯 회복 트리거, 알림/추천/정렬 고도화, 썸네일 생성

## 4. 설계 결정
- Endpoint: `GET /api/capsules`
- Query: lat, lng (필수), radius_m (기본 300, 10~5000), limit(기본 50, 최대 200), cursor, include_locationless?, include_consumed?
- 접근 필터: friendships CONNECTED, 위치 반경 내
- 소비 상태: view_limit>0 && view_count>=view_limit → 기본 제외, include_consumed=true 시 `can_open=false`로 포함
- 출력: distance_m, is_locked(open_at>now), media preview 우선(프리뷰 1개 또는 전체? 기본: 프리뷰 제공)
- 정렬: distance ASC, tie → created_at DESC; cursor 기반 페이지

## 5. 데이터 모델 영향
- DB 스키마 변경 없음. 지오 계산을 위한 latitude/longitude 인덱스 고려(선택).

## 6. API 설계 (초안)
- `GET /api/capsules`
  - Auth: Bearer JWT
  - Query: lat, lng, radius_m, limit, cursor, include_locationless?, include_consumed?
  - 200: items[], page_info{next_cursor}
  - 400: 좌표/반경/limit 유효성 실패
  - 401: 인증 실패

## 7. 비즈니스 규칙/검증
- lat ∈ [-90,90], lng ∈ [-180,180], radius_m ∈ [10,5000], limit ≤ 200
- 친구 검증: friendships CONNECTED 존재 시 노출, 아니면 제외
- 위치 검증: 거리 <= radius_m
- is_locked: open_at > now → true (content/null 처리)
- consumed: view_limit>0 && view_count>=view_limit → 기본 제외, 옵션 시 포함+can_open=false
- product: 존재 시 product_type/max_media_count/media_types 동봉

## 8. 에러 코드 가이드
- 400: 잘못된 좌표/반경/limit 형식/범위
- 401: 인증 실패
- 403: 시스템 정책 차단 시 (예외적)

## 9. 테스트 전략
- 200: 반경 내+친구 연결 → 노출, distance 정렬, is_locked 계산
- 200: include_consumed=true 시 소진 캡슐 can_open=false로 포함
- 제외: 반경 밖, 친구 아님, consumed 기본 제외
- 400: 좌표 범위/반경/limit 초과
- 페이징: limit+cursor 동작 확인

## 10. 작업 개요 (tasks로 세분화 예정)
- Query DTO/validation, Controller wiring, Service 필터/정렬/페이징, Repo 쿼리/Haversine, Swagger, e2e 커버리지

