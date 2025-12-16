# Plan: 이스터에그 조회 API

## 1. 목표
- `GET /api/capsules/:id`로 캡슐 상세 조회 (JWT 인증)
- 접근 제약: (A) 위치 도달, (B) 작성자와 친구(connected)일 때만 열람
- 잠금 여부(open_at), 남은 조회 가능 횟수(view_limit vs view_count), 미디어 배열 반환
- 삭제된 캡슐/없는 캡슐은 404 처리

## 2. 인풋 & 의존성
- spec: `specs/002-egg-fetch/spec.md`
- 엔티티: capsules, products, users
- 기존 enum: MediaType
- 인증: JwtAuthGuard

## 3. 범위
- 포함: 단건 조회, 잠금 상태 계산, 미디어 배열/제품 정보 반환, 친구/위치 기반 접근 검증
- 제외: view_count 증가, 슬롯 회복 실행

## 4. 설계 결정
- Controller: `GET /api/capsules/:id`
- Service: findOne with relations(product)
- Lock 판단: `is_locked = open_at && open_at > now`
- soft delete: deleted_at 존재 시 404
- 미디어: 길이 ≤3, enum 검증

## 5. 데이터 모델 영향
- DB 변경 없음 (기존 capsules/products 사용)

## 6. API 설계 (초안)
- `GET /api/capsules/:id`
  - Auth: Bearer JWT
  - Query(optional): `lat`, `lng` (사용자 현재 좌표, 위치 검증용)
  - 200: id, title, content, open_at, is_locked, view_limit, view_count, media_types[], media_urls[], product{ id, product_type, max_media_count }, latitude, longitude
  - 400: uuid 형식 오류, lat/lng 형식 오류
  - 401: 인증 실패
  - 403: 위치 미도달 또는 친구 아님
  - 404: 미존재/삭제됨

## 7. 비즈니스 규칙/검증
- UUID 형식 검증
- deleted_at null 아닌 경우 404
- media 배열 길이 ≤3, enum 값만 반환
- is_locked 계산: open_at > now → true, else false
- 접근 제약:
  - 친구 관계: friendships CONNECTED 존재 여부
  - 위치 도달: lat/lng 제공 시 캡슐 좌표와의 거리 ≤ 허용 반경(예: 50m, 추후 확정). 미제공 시 400 또는 403 (정책 결정 필요)

## 8. 에러 코드 가이드
- 400: 잘못된 id 형식
- 401: 인증 실패
- 404: 캡슐 미존재 또는 삭제됨

## 9. 테스트 전략
- 200: 정상 조회, is_locked 계산, media 배열 길이 3 이하
- 403: 친구 아님
- 403/400: 위치 미제공 또는 허용 반경 밖 (정책에 따라)
- 404: 없는 id
- 404: deleted_at 세팅된 캡슐
- 400: uuid 아님

## 10. 작업 개요 (tasks로 세분화 예정)
- Controller + DTO (param UUID 검증)
- Service 조회 + soft delete 체크 + 응답 매핑
- Swagger 문서 추가
- e2e: 정상 200, 404 미존재, 404 deleted, 400 invalid uuid

