# Tasks: Capsule Entry & Fetch API

## Phase 1: Setup
- [ ] T001 [US-setup] 마이그레이션 설계/작성: `capsule_participant_slots`, `capsule_entries` 테이블 생성 및 제약 추가

## Phase 2: Foundational
- [ ] T002 [US-core] Entity 추가/매핑: 신규 엔티티/관계 정의(`capsule_participant_slots`, `capsule_entries`), 기존 `capsule.entity` 연계
- [ ] T003 [US-core] 슬롯 생성 로직: headcount 기반 슬롯 사전 생성 또는 조회 시 보정 로직 구현

## Phase 3: User Stories (P1)
- [ ] T004 [US1] 캡슐 조회 유즈케이스: PAID 검증, 권한 확인(주문자/슬롯 배정 사용자), 슬롯 리스트 + 작성 내용/미디어 반환, 접근 로그 기록
- [ ] T005 [US1] 글 작성 유즈케이스: 빈 슬롯 배정 + entry 생성 트랜잭션, 중복 작성/타 슬롯 접근 차단(403/409), 미디어 소유 검증
- [ ] T006 [US1] DTO/검증: content 길이 제한(기본 2000자 제안), media_item_ids 길이/타입 검증, Swagger 스키마 정의

## Phase 4: Tests
- [ ] T007 [US1] 단위 테스트: 슬롯 배정/중복 작성/권한/미디어 소유/미디어 타입·크기 검증 실패 케이스
- [ ] T008 [US1] 통합/E2E: PAID vs 미결제 접근, 작성 후 재작성 차단, headcount 초과 시도 차단, 조회 시 슬롯/작성 정보 확인

## Final Phase: Polish
- [ ] T009 [Polish] 문서/Swagger 업데이트, 린트/포맷, 마이그레이션 반영 최종 검수

