# Feature: 이스터에그 작성 API (다중 미디어/소모형 캡슐)

## 개요
- 사용자가 지도/좌표 기반으로 숨겨진 이스터에그(캡슐)를 작성하고 저장하는 API
- 미디어 타입 제약: TEXT/IMAGE/VIDEO/MUSIC (상품 기반 정책 유지)
- **다중 미디어 지원**: 최대 3개 미디어까지 저장 가능 (없으면 null 허용)
- 개봉 시간(open_at) 이전에는 잠김 상태 유지
- 선착순(view_limit) 설정으로 조회 가능 인원 제한 가능
- **소모형 캡슐 정책**: 유저는 항상 3개의 “작성 가능 이스터에그 슬롯”을 보유
  - 캡슐을 작성하면 슬롯 1개가 소모되어 “사라진 것”으로 간주
  - view_limit 소진(최대 조회수 소진) 시 슬롯을 다시 1개 부여하여 재작성 가능

## 목표
- 사용자가 이스터에그를 생성하고 필요한 메타데이터를 저장할 수 있어야 한다.
- 위치 좌표, 개봉 시각, **최대 3개의 미디어 URL/타입**을 안전하게 저장한다.
- 캡슐 소모/재부여 정책에 따라 작성 가능 슬롯을 관리한다.
- 향후 조회/개봉/친구 공유 흐름에 재사용 가능한 스키마를 제공한다.

## 비범위
- 결제/상품 구매 흐름
- 알림 발송 (푸시/이메일)
- 조회/개봉 로직 및 조회수 증가 처리

## 이해관계자 및 액터
- **Authenticated User**: JWT 기반 인증된 사용자, 캡슐 작성 주체
- **System**: 입력 검증, 좌표/시간/미디어 정책 검증, 데이터 저장

## 사용자 시나리오
1. 사용자가 앱에서 위치를 선택하고 제목/내용(최대 500자)을 입력한 뒤 이스터에그를 생성한다.
2. (선택) 최대 3개의 미디어를 업로드해 media_urls[*]와 media_types[*]를 지정한다. (모두 null 가능)
3. (선택) 선착순 인원 제한(view_limit)과 개봉 시각(open_at)을 설정한다.
4. 생성 성공 시 캡슐 ID를 반환받는다.
5. 캡슐이 생성되면 작성 가능 슬롯이 1개 소모된다.
6. 캡슐의 view_limit이 모두 소진되면 슬롯이 1개 회복되어 재작성 가능해진다.

## 기능 요구사항 (테스트 가능)
1. **인증 필수**: JWT를 통해 인증된 사용자만 생성 가능해야 한다.
2. **작성 슬롯 제약**: 사용자는 항상 3개의 작성 가능 슬롯을 갖는다. 슬롯이 0이면 409를 반환해야 한다.
3. **슬롯 소모**: 캡슐 생성 시 슬롯 1개를 소모한다.
4. **슬롯 회복**: view_limit 도달(또는 0이 아니고 view_count==view_limit) 시 슬롯을 1개 회복한다.
5. **위치 좌표 검증**: latitude/longitude가 decimal 형식 범위 내인지 검증해야 한다.
6. **제목/내용 길이**: title 최대 500자, content 최대 500자. 초과 시 400.
7. **미디어 제약**:
   - 최대 3개까지 media_urls[], media_types[] 허용 (길이 0~3)
   - media_types 값은 TEXT/IMAGE/VIDEO/MUSIC 중 하나여야 한다.
   - media_urls는 null 허용. 단 media_type이 TEXT가 아닐 때 해당 index의 media_url이 없으면 400.
8. **개봉 시간 정책**: open_at 미지정 시 is_locked=true로 저장한다. open_at이 과거면 400 반환한다.
9. **선착순 제한**: view_limit 미지정 시 0(무제한)으로 저장한다. 음수 입력 시 400 반환한다.
10. **제품 연동 옵션**: product_id는 선택 입력이다. 값이 있을 경우 products 테이블에 존재해야 한다. 없으면 404/400을 반환한다.
11. **기본 미디어 타입**: media_types 미지정 시 첫 슬롯은 TEXT로 간주, 나머지는 null 허용.
12. **응답 형식**: 생성 성공 시 201과 함께 캡슐 id, open_at, is_locked, view_limit, media_types, media_urls를 반환한다.
13. **감사 메타**: created_at 자동 저장, user_id 필수 저장.

## API 개요 (초안)
- `POST /api/capsules`
  - Auth: Bearer JWT
  - Body:
    - title (string, required, <=500)
    - content (string, optional, <=500)
    - latitude (number, optional)
    - longitude (number, optional)
    - media_urls (string[] length 0~3, optional, nullable entries 허용)
    - media_types (enum[] length 0~3, TEXT|IMAGE|VIDEO|MUSIC, 첫 슬롯 기본 TEXT)
    - open_at (datetime, optional; must be future)
    - view_limit (int, optional; default 0)
    - product_id (uuid, optional)
  - Responses:
    - 201: { id, title, open_at, is_locked, view_limit, media_types[], media_urls[] }
    - 400: validation 실패 (길이/타입/미디어-URL 불일치/과거 open_at/음수 view_limit)
    - 401: 인증 실패
    - 404: product_id가 존재하지 않을 때
    - 409: 작성 슬롯 부족

## 데이터 모델 참고 (기존 엔티티 활용)
- `capsules` 테이블 필드 활용 + 다중 미디어 표현 필요:
  - id (uuid, pk)
  - user_id (uuid, fk users.id)
  - product_id (uuid, nullable, fk products.id)
  - latitude (decimal(10,8)), longitude (decimal(11,8))
  - title, content
  - **media_urls (array or json), media_types (array or json) 최대 길이 3**
  - open_at, is_locked (bool), view_limit (int), view_count (int, default 0)
  - created_at, deleted_at
- 슬롯 관리는 별도 테이블 또는 users 필드 확장으로 고려 (예: user_capsule_slots)

## 성공 기준
- 인증된 사용자가 유효한 요청으로 201 응답을 받아야 한다.
- 작성 슬롯이 없을 때 409를 반환해야 한다.
- open_at이 과거일 경우 400을 반환해야 한다.
- media_types가 TEXT가 아닌 슬롯에 대응하는 media_url이 없으면 400을 반환해야 한다.
- product_id가 존재하지 않을 경우 404/400을 반환해야 한다.
- 저장된 데이터가 DB 스키마 제약(미디어 타입 enum, decimal 정밀도, unique/nullable 규칙, media 배열 길이 3)에 부합해야 한다.
- view_limit 소진 시 슬롯이 회복되어야 한다.

## 가정 / 기본값
- 위치 정보는 선택사항이며, 미제공 시 null로 저장한다.
- view_limit 0은 무제한을 의미한다.
- media_url은 사전 업로드된 CDN/S3 경로라고 가정한다(업로드 API 별도).
- 타임존은 서버 기본 타임존(UTC 가정) 기준으로 검증한다.

## 오픈 질문
- open_at의 최소 지연 시간(예: 현재 시각 + N분) 필요 여부? (기본: 0분)
- 제목/내용 금칙어 정책? (현재: 500자 제한만 적용)
- media_url 도메인 화이트리스트 필요 여부? (현재: 미검증)
- media_urls/media_types 저장 방식을 배열(JSON)로 할지, 별도 media 테이블로 분리할지?


