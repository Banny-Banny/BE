# Implementation Plan: 관리자 인증/대시보드/유저 관리

## Architecture / Approach

- `AdminUser` 엔티티 및 마이그레이션 추가 (`admin_users` 테이블)
- `AdminModule` 생성 후 `AdminAuth`, `AdminDashboard`, `AdminUsers` 컨트롤러/서비스 분리
- 관리자용 JWT Strategy/Guard/Decorator 추가 (`admin-jwt`)
- 관리자 토큰: access/refresh 분리, refresh token 해시 저장 및 회전
- 기존 `users`, `payments`, `customer_services`, `capsule_access_logs` 재사용

## Data Model Changes

- 신규 테이블 `admin_users`
  - `id`, `email`(unique), `name`, `password_hash`, `role`, `token_version`
  - `refresh_token_hash`, `is_active`, `created_at`, `updated_at`

## API Surface

- `POST /admin/auth/login`
- `POST /admin/auth/refresh`
- `POST /admin/auth/logout`
- `POST /admin/auth/admins` (SUPER_ADMIN only)
- `GET /admin/auth/me`
- `GET /admin/dashboard/summary`
- `GET /admin/dashboard/charts`
- `GET /admin/users`
- `GET /admin/users/:id`
- `POST /admin/users/:id`
- `POST /admin/users/:id/deactivate`
- `POST /admin/users/:id/block`
- `POST /admin/users/:id/unblock`

## Security / Permissions

- 관리자 전용 JWT (`admin-jwt`) 및 role 기반 검증
- `admin_users.refresh_token_hash`로 재발급 토큰 검증
- `is_active=false` 관리자 로그인 차단

## Risks & Mitigations

- 초기 SUPER_ADMIN 부재: 운영 절차로 DB 시드 또는 수동 생성 필요
- DAU 계산 기준 모호: `capsule_access_logs` 기준으로 일간 유니크 집계
