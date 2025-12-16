# Feature: 이스터에그 위치 기반 목록 API (디스플레이용)

## 개요
- 사용자가 자신의 위도/경도를 쿼리로 보내면, 해당 반경/디스플레이 영역에 포함된 이스터에그(캡슐) 목록을 반환하는 API.
- 지도/리스트 UI에 표시 가능한 최소 정보 + 개봉 조건(open_at, view_limit)을 함께 제공.
- JWT 인증 기반으로 친구 관계/위치 조건을 만족하는 캡슐만 노출.

## 목표
- 현재 뷰(지도/리스트)의 위치 정보에 따라 접근 가능한 이스터에그를 필터링해 일괄 반환.
- is_locked 상태, 잔여 조회 가능 여부(view_limit, view_count), 제품 정보까지 함께 제공해 FE가 개봉 가능 여부를 즉시 판단하도록 함.

## 비범위
- 개별 캡슐 상세 조회(별도 GET /api/capsules/:id).
- 슬롯 회복 트리거, 알림/추천/정렬 고도화.
- 업로드/미디어 썸네일 생성 로직.

## 이해관계자 및 액터
- **Authenticated User**: JWT 인증 사용자, 지도/리스트에서 캡슐을 탐색.
- **System**: 위치 반경 필터, 친구 관계 필터, 잠금 여부/조회 가능 여부 계산 후 목록 반환.

## 사용자 시나리오
1. 사용자가 지도의 현재 뷰(중심 lat/lng, 반경)를 기준으로 이스터에그 목록을 요청한다.
2. 서버는 위치 반경과 친구 관계를 모두 만족하는 캡슐만 필터링한다.
3. open_at이 미래인 캡슐은 is_locked=true로 내려주고 콘텐츠는 숨긴다.
4. view_limit이 모두 소진된 캡슐은 목록에서 제외하거나(기본) 소진 상태로 표시한다(옵션).
5. FE는 distance, is_locked, view_limit 등을 이용해 지도에 마커/리스트를 표시한다.

## 기능 요구사항 (테스트 가능)
1. **인증 필수**: Bearer JWT 없으면 401.
2. **위치 파라미터 필수**: `lat`, `lng` 필수. decimal 범위(lat -90~90, lng -180~180) 벗어나면 400.
3. **반경 필터**: `radius_m` 선택 입력 (기본 300m, 최소 10m, 최대 5000m). 반경 내 캡슐만 반환, 초과 시 400.
4. **친구 제약**: 요청자와 캡슐 작성자가 친구(STATUS=CONNECTED)인 경우에만 포함. 불충족 시 403 대신 목록에서 제외.
5. **위치 제약**: 캡슐 좌표가 없거나 null이면 기본적으로 목록에서 제외(옵션: include_locationless=true 시 포함 가능).
6. **슬롯 소진/조회 제한**: `view_limit > 0 && view_count >= view_limit` 캡슐은 기본적으로 목록에서 제외. `include_consumed=true` 시 소진 상태로 표시하며 `can_open=false`.
7. **잠금 상태**: `open_at > now` 이면 `is_locked=true`, `content`는 null/마스킹. media_urls/media_types는 내려주되 FE가 숨김 처리 가능.
8. **미디어 제약**: media_urls/media_types 길이 ≤ 3, enum(TEXT/IMAGE/VIDEO/MUSIC) 준수. 타입-URL 불일치 데이터는 저장 단계에서만 허용하지 않으며 목록 시 정합성을 보장.
9. **정렬/페이징**: 기본 distance ASC, tie-breaker created_at DESC. `limit` (기본 50, 최대 200), `cursor` 기반 페이징 지원.
10. **제품 정보**: product_id가 있으면 product_type, max_media_count, media_types를 함께 내려준다.
11. **삭제/비활성**: deleted_at이 있거나 비활성화된 캡슐/상품은 노출하지 않는다.
12. **응답 성능**: 위치/친구 필터는 인덱스/지오 연산(Haversine)으로 처리하고 N+1 없이 join/select로 반환.

## API 개요 (초안)
- `GET /api/capsules`
  - Auth: Bearer JWT
  - Query:
    - `lat` (number, required), `lng` (number, required)
    - `radius_m` (number, optional, default 300, min 10, max 5000)
    - `limit` (int, optional, default 50, max 200)
    - `cursor` (string, optional; created_at/id 기반)
    - `include_locationless` (bool, optional, default false)
    - `include_consumed` (bool, optional, default false)
  - Responses:
    - 200:
      ```json
      {
        "items": [
          {
            "id": "uuid",
            "title": "capsule",
            "content": null,
            "open_at": "2025-12-31T00:00:00.000Z",
            "is_locked": true,
            "view_limit": 1,
            "view_count": 0,
            "can_open": false,
            "latitude": 37.123456,
            "longitude": 127.123456,
            "distance_m": 120.5,
            "media_types": ["IMAGE"],
            "media_urls": ["https://..."],
            "product": {
              "id": "uuid|null",
              "product_type": "EASTER_EGG|TIME_CAPSULE",
              "max_media_count": 3,
              "media_types": ["IMAGE"]
            }
          }
        ],
        "page_info": { "next_cursor": "..." }
      }
      ```
    - 400: 위치/반경/limit 유효성 실패
    - 401: 인증 실패
    - 403: (예외적) 시스템 차단 정책 위반 시

## 데이터 모델 참고
- `capsules`: latitude, longitude, open_at, is_locked, view_limit, view_count, media_urls[], media_types[], product_id, deleted_at
- `friendships`: status=CONNECTED 필터로 접근 제한
- `products`: product_type, max_media_count, media_types

## 성공 기준
- 유효한 JWT와 올바른 위치 파라미터로 요청 시 200과 함께 반경 내 접근 가능한 캡슐 목록을 반환.
- 반경/limit/좌표 유효성 오류 시 400 반환.
- view_limit을 초과한 캡슐은 기본적으로 노출하지 않거나 소진 상태로 표시.
- open_at 미도달 캡슐은 is_locked=true로 내려주고 content는 노출하지 않는다.

## 가정 / 기본값
- 거리 계산은 Haversine 또는 PostGIS ST_DWithin 사용, 단위 meter.
- view_limit 0은 무제한으로 간주하며 소진 제외 로직에 걸리지 않는다.
- include_locationless=false일 때 좌표 없는 캡슐은 목록에 나타나지 않는다.
- 타임존은 서버(UTC) 기준 검증.

## 오픈 질문
- 지도 “디스플레이 영역”을 반경(radius)로 단순화해도 되는가? bbox 파라미터 필요 여부?
- view_limit 소진 캡슐을 완전히 숨길지, “소진됨” 상태로 노출할지 최종 UX 합의? 완전히 숨긴다.
- distance_m 정밀도 및 반올림 규칙? 
- media_urls를 목록에서도 전부 내려줄지, 프리뷰 1개만 내려줄 옵션이 필요한지? 우선 프리뷰로 제공.

