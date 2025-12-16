# Tasks: 이스터에그 위치 기반 목록 API

## Phase 1: Controller/DTO
- [ ] T001 Query DTO: lat/lng 필수, radius_m(기본 300, 10~5000), limit(기본 50, 최대 200), cursor(optional), include_locationless?, include_consumed?
- [ ] T002 `CapsulesController` GET `/api/capsules` 엔드포인트 등록 + Swagger 문서

## Phase 2: Service/Query
- [ ] T003 Service 메서드 `findNearby` 구현 (distance 계산, cursor 페이징, distance ASC 정렬, tie=created_at DESC)
- [ ] T004 친구 필터: friendships CONNECTED join/exists로 요청자-작성자 관계 확인
- [ ] T005 위치 필터: Haversine 혹은 DB 함수로 radius_m 이하만 포함; include_locationless=false 시 좌표 null 제외
- [ ] T006 소비 필터: view_limit>0 && view_count>=view_limit 기본 제외; include_consumed=true 시 can_open=false로 매핑
- [ ] T007 is_locked 계산(open_at>now), media preview 우선 반환, product info join

## Phase 3: Tests (e2e)
- [ ] T008 200: 반경 내 + 친구 → 노출, distance 정렬, is_locked 반영
- [ ] T009 200: include_consumed=true 시 소진 캡슐 can_open=false 포함
- [ ] T010 제외 케이스: 반경 밖, 친구 아님, 좌표 null (include_locationless=false)
- [ ] T011 400: 좌표 범위 초과, radius_m/limit 범위 초과
- [ ] T012 페이징: limit+cursor로 이어서 조회 가능

## Phase 4: Polish
- [ ] T013 Swagger 예제/쿼리 파라미터/응답 스키마 갱신
- [ ] T014 DB 쿼리/인덱스 메모: 지오 계산/정렬 성능 검토 주석 남기기

