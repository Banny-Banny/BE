# Tasks - Admin User Join/Withdraw Trends

## Phase 1: Setup

- [ ] T001 specs/024-admin-user-trends 문서 검토 및 보완

## Phase 2: Foundational

- [ ] T002 [P] Admin 대시보드 인증/인가 가드 위치 확인 (`src/admin`)
- [ ] T003 [P] 사용자 탈퇴 컬럼(`deletedAt`) 확인 (`src/entities`)

## Phase 3: User Stories

- [ ] T004 [US1] DTO 생성 및 검증 로직 추가 (`src/admin/dashboard/dto`)
- [ ] T005 [US1] 서비스 집계 로직 구현 (`src/admin/dashboard/admin-dashboard.service.ts`)
- [ ] T006 [US1] 컨트롤러 엔드포인트 추가 (`src/admin/dashboard/admin-dashboard.controller.ts`)
- [ ] T007 [US2] period 검증 및 에러 처리 추가 (`src/admin/dashboard`)

## Final Phase: Polish

- [ ] T008 응답 스키마/Swagger 문서 확인 및 정리
- [ ] T009 필요 시 테스트 추가 또는 기존 테스트 업데이트
