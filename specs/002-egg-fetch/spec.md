# Feature: 이스터에그 조회 API (읽기/소모형 슬롯 회복 트리거)

## 개요
- 사용자가 지도/좌표 기반으로 숨겨진 이스터에그(캡슐)를 조회하고 개봉 상태/잔여 조회수를 확인하는 API
- **접근 제약**: (A) 사용자가 해당 좌표에 도달했고, (B) 작성자와 친구(connected)인 경우에만 열람 가능
- 최대 3개 미디어를 내려주며, view_limit 소진 시 슬롯 회복 트리거를 고려
- JWT 인증 기반 조회

## 목표
- 지정된 캡슐 ID를 안전하게 조회하고, 콘텐츠/미디어/개봉 조건을 반환
- view_limit 소진(또는 0이 아닌 경우 view_count == view_limit) 시 작성 슬롯 회복 로직을 후속 단계에서 트리거할 수 있도록 데이터 제공

## 비범위
- 슬롯 회복 실행 로직(본 스펙은 조회 API에 필요한 데이터 제공에 집중)
- 알림/친구 공유/추천/정렬 로직
- 수정/삭제 API

## 이해관계자 및 액터
- **Authenticated User**: JWT 인증 사용자, 캡슐을 조회/개봉
- **System**: open_at 기준 잠금 여부 판단, view_limit/ view_count 반환

## 사용자 시나리오
1. 사용자가 지도에서 특정 캡슐을 탭 → 상세 조회 요청
2. 서버는 open_at과 현재 시간 비교해 is_locked 여부를 내려줌
3. 서버는 view_limit, view_count 정보를 내려줘 남은 개봉 가능 횟수를 표시
4. (후속 로직) view_limit이 모두 소진된 캡슐을 확인해 슬롯 회복을 처리할 수 있음

## 기능 요구사항 (테스트 가능)
1. **인증 필수**: JWT 필요, 없으면 401.
2. **존재 여부**: 캡슐 ID가 없으면 404.
3. **접근 제약**:
   - 위치 도달: 요청자가 제공한 현재 좌표가 캡슐 좌표와 허용 반경 내에 있어야 한다. (반경 기본: 후속 결정)
   - 친구 관계: 요청자와 작성자가 친구(Friendship CONNECTED)여야 한다.
   - 둘 중 하나라도 불충족하면 403.
4. **잠금 상태**: open_at > now → is_locked=true 로 응답해야 한다.
5. **미디어 데이터**: media_urls/media_types 배열 길이 최대 3, TEXT/IMAGE/VIDEO/MUSIC 외 타입은 내려주지 않는다.
6. **슬롯 회복 판단용 데이터**: view_limit, view_count 반환 (view_limit>0 && view_count>=view_limit 여부 판단 가능)
7. **제품 정보**: product_id, product_type, max_media_count를 함께 내려 정책 확인 가능하도록 한다.
8. **위치 정보**: latitude/longitude를 내려 UI 표시 가능 (nullable 허용).
9. **삭제/비활성**: deleted_at이 있으면 404로 취급.

## API 개요 (초안)
- `GET /api/capsules/:id`
  - Auth: Bearer JWT
  - Params: `id` (uuid)
  - Responses:
    - 200:
      ```json
      {
        "id": "uuid",
        "title": "...",
        "content": "...",
        "open_at": "2025-12-31T00:00:00.000Z",
        "is_locked": true,
        "view_limit": 1,
        "view_count": 0,
        "media_types": ["IMAGE", ...],
        "media_urls": ["https://...", ...],
        "product": {
          "id": "uuid|null",
          "product_type": "EASTER_EGG|TIME_CAPSULE",
          "max_media_count": 3
        },
        "latitude": 37.12345678,
        "longitude": 127.12345678
      }
      ```
    - 401: 인증 실패
    - 404: 미존재 또는 삭제됨
    - 400: id 형식 오류

## 데이터 모델 참고
- `capsules`: id, title, content, media_urls[], media_types[], open_at, is_locked, view_limit, view_count, latitude, longitude, product_id
- `products`: product_type, max_media_count, media_types[]
- `users`: egg_slots (본 API는 조회만, 회복 판단용 데이터 제공)

## 성공 기준
- 유효한 JWT와 존재하는 캡슐 ID에 대해 200 응답을 반환
- 삭제되었거나 없는 캡슐이면 404 반환
- 미디어 배열 길이 ≤ 3, 타입 enum 준수
- open_at 미래면 is_locked=true 로 내려줌

## 가정 / 기본값
- 위치 정보가 없으면 null 반환
- view_limit=0 은 무제한을 의미 (is_locked만 확인)
- product가 없으면 product 필드는 null 로 반환

## 오픈 질문
- view_count 증가/슬롯 회복을 조회 시점에 트리거할지, 별도 엔드포인트로 둘지?
- 접근 권한: 친구만 조회로 고정할지, 추후 공개/비공개 플래그를 둘지?
- 위치 반경 허용치(meter) 기본값?
- 응답에서 미디어 프리뷰/썸네일이 필요한지?

