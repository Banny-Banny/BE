# Implementation Plan - Admin User Join/Withdraw Trends

## Overview

Admin 대시보드에서 최근 90일 가입/탈퇴 추이를 날짜별로 제공하는 API를 추가한다. `users` 테이블의 `createdAt`, `deletedAt`을 집계하고, 누락된 날짜는 0으로 보정해 연속적인 배열을 반환한다.

## Phase 0 - Research

- 탈퇴 기준 컬럼을 `deletedAt`으로 확정 (soft delete 표준)
- 기존 admin dashboard 모듈의 인증/인가 가드 확인

## Phase 1 - Design

- DTO: `period`를 90d로 제한 (확장 여지 고려)
- Service: 가입/탈퇴 각각 날짜별 집계 후 합치기
- Controller: `GET /api/admin/dashboard/user-trends`
- Swagger 문서화

## Phase 2 - Implementation

1. `AdminDashboardService`에 추이 집계 메서드 추가
2. `AdminDashboardController`에 엔드포인트 추가 및 DTO 연결
3. 날짜 보정 유틸 함수 추가 (서비스 내 혹은 공용 유틸)

## Phase 3 - Validation

- 정상 호출 시 90개 레코드 반환
- 빈 날짜 보정 동작 확인
- 인증/인가 가드 동작 확인

## Artifacts

- `specs/024-admin-user-trends/contracts/api-spec.json`
- `specs/024-admin-user-trends/quickstart.md`
