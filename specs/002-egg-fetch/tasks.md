# Tasks: 이스터에그 조회 API

## Phase 1: Controller/DTO
- [ ] T001 Param DTO로 `id` UUID 검증 (BadRequest 400)
- [ ] T002 Query DTO로 `lat/lng` 옵션 검증 (number)
- [ ] T003 `CapsulesController` GET `/api/capsules/:id` + Swagger 문서 (403 시나리오 포함)

## Phase 2: Service
- [ ] T004 `CapsulesService.findOne` 구현
  - caps + product 조인
  - deleted_at 존재 시 404
  - media 배열 길이/enum 검증 후 그대로 반환
  - is_locked 계산 (open_at > now)
  - 친구 검증: friendships CONNECTED (요청자-작성자) 확인
  - 위치 검증: lat/lng 제공 시 캡슐 좌표와의 거리 <= 허용 반경(예: 50m) 미충족 시 403 (미제공 시 400 또는 403, 정책 확정 필요)

## Phase 3: Tests (e2e)
- [ ] T005 정상 200: 친구 + 위치 조건 만족, is_locked 계산 확인
- [ ] T006 403: 친구 아님
- [ ] T007 403/400: 위치 반경 밖 또는 좌표 미제공 정책 검증
- [ ] T008 404: 없는 id
- [ ] T009 404: deleted_at 설정된 캡슐
- [ ] T010 400: uuid 형식 아님

## Phase 4: Polish
- [ ] T011 Swagger 예제 갱신 (Capsules 조회 응답, 403 사례 추가)***

