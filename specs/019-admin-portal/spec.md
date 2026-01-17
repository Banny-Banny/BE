# Feature Specification: 관리자 인증/대시보드/유저 관리

**Feature Branch**: `[019-admin-portal]`  
**Created**: 2026-01-17  
**Status**: Draft  
**Input**: User description: "관리자 인증, 대시보드, 유저 관리 기능을 spec.kit으로 구현하고 기존 구현은 재사용"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 관리자 로그인/토큰 재발급 (Priority: P1)

관리자는 이메일/비밀번호로 로그인하여 Access/Refresh Token을 발급받고, Refresh Token으로 재발급할 수 있다.

**Why this priority**: 관리자 콘솔 접근과 보안의 핵심 흐름이므로 P1.  
**Independent Test**: `POST /admin/auth/login` → 200 + tokens, `POST /admin/auth/refresh` → 200 + new tokens.

**Acceptance Scenarios**:
1. **Given** 유효한 관리자 계정, **When** `/admin/auth/login` 요청, **Then** access/refresh 토큰과 관리자 프로필을 반환한다.
2. **Given** 만료 전 refresh token, **When** `/admin/auth/refresh` 요청, **Then** 새 access/refresh 토큰을 발급한다.
3. **Given** 비밀번호 불일치 또는 비활성 계정, **When** `/admin/auth/login` 요청, **Then** 401/403 에러를 반환한다.

---

### User Story 2 - 관리자 계정 생성 및 프로필 조회 (Priority: P1)

슈퍼 어드민은 일반 관리자를 초대하고, 관리자는 자신의 프로필을 조회할 수 있다.

**Why this priority**: 관리자 운영 흐름의 기본 기능이며 권한 분리를 보장해야 한다.  
**Independent Test**: 슈퍼 어드민 토큰으로 `POST /admin/auth/admins` → 201, `GET /admin/auth/me` → 200.

**Acceptance Scenarios**:
1. **Given** SUPER_ADMIN 권한, **When** `/admin/auth/admins` 요청, **Then** ADMIN 계정이 생성된다.
2. **Given** ADMIN 권한, **When** `/admin/auth/admins` 요청, **Then** 403 Forbidden 응답.
3. **Given** 인증된 관리자, **When** `/admin/auth/me` 요청, **Then** 자기 프로필을 반환한다.

---

### User Story 3 - 대시보드 요약/차트 (Priority: P2)

관리자는 대시보드에서 금일 가입자/문의/DAU 및 가입자·매출 추이 데이터를 확인한다.

**Why this priority**: 운영 인사이트를 위한 필수 정보로 P2.  
**Independent Test**: `GET /admin/dashboard/summary`, `GET /admin/dashboard/charts?period=day`.

**Acceptance Scenarios**:
1. **Given** 관리자 로그인, **When** `/admin/dashboard/summary` 요청, **Then** 금일 가입자/문의/DAU 카운트를 반환한다.
2. **Given** 기간 파라미터, **When** `/admin/dashboard/charts` 요청, **Then** 기간별 가입자/매출 추이 배열을 반환한다.

---

### User Story 4 - 유저 관리 (Priority: P1)

관리자는 유저 목록을 검색/필터/페이지네이션으로 조회하고, 상세 정보 확인 및 정보 수정/차단/탈퇴 처리를 수행한다.

**Why this priority**: 고객 지원 및 운영 필수 기능으로 P1.  
**Independent Test**: `GET /admin/users`, `GET /admin/users/:id`, `POST /admin/users/:id`, `POST /admin/users/:id/block`, `POST /admin/users/:id/deactivate`.

**Acceptance Scenarios**:
1. **Given** 검색/필터 조건, **When** `/admin/users` 요청, **Then** 조건에 맞는 목록과 메타데이터를 반환한다.
2. **Given** 유효한 유저 ID, **When** `/admin/users/:id` 요청, **Then** 기본 정보 + 활동 로그 + 디바이스 정보를 반환한다.
3. **Given** 관리자 권한, **When** `/admin/users/:id` 수정 요청, **Then** 유저 정보가 업데이트된다.
4. **Given** 악성 유저, **When** `/admin/users/:id/block` 요청, **Then** `is_active=false` 로 변경된다.
5. **Given** 탈퇴 처리 필요, **When** `/admin/users/:id/deactivate` 요청, **Then** soft delete + 비활성 처리된다.

---

### Edge Cases

- Refresh token 재사용 또는 만료 시 401 반환.
- 관리자 비활성 상태일 경우 로그인/재발급 거부.
- 유저 목록 필터에서 날짜 범위가 잘못된 경우 400 반환.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `POST /admin/auth/login`은 access/refresh 토큰을 발급한다.
- **FR-002**: `POST /admin/auth/refresh`는 refresh token을 검증하고 토큰을 재발급한다.
- **FR-003**: `POST /admin/auth/admins`는 SUPER_ADMIN만 호출 가능하며 일반 관리자 계정을 생성한다.
- **FR-004**: `GET /admin/auth/me`는 현재 관리자 프로필을 반환한다.
- **FR-005**: `/admin/dashboard/summary`는 금일 가입자/문의/DAU를 집계한다.
- **FR-006**: `/admin/dashboard/charts`는 기간별 가입자/매출 추이를 반환한다.
- **FR-007**: `/admin/users`는 검색/필터/페이지네이션을 지원한다.
- **FR-008**: `/admin/users/:id`는 유저 기본 정보, 활동 로그, 디바이스 정보를 반환한다.
- **FR-009**: `/admin/users/:id` 수정은 관리자 권한으로 강제 업데이트를 허용한다.
- **FR-010**: `/admin/users/:id/deactivate`는 soft delete를 수행한다.
- **FR-011**: `/admin/users/:id/block`, `/admin/users/:id/unblock`은 `is_active`를 토글한다.

### Key Entities *(include if feature involves data)*

- **AdminUser (`admin_users`)**: `email`, `password_hash`, `role`, `token_version`, `refresh_token_hash`, `is_active` 포함.
- **User (`users`)**: 기존 구조 그대로 사용하며 관리 기능은 `is_active`, `deleted_at` 를 기반으로 동작.
- **CustomerService (`customer_services`)**: 신규 문의 집계에 사용.
- **CapsuleAccessLog (`capsule_access_logs`)**: DAU 및 활동 로그 집계에 사용.
- **Payment (`payments`)**: 매출 집계에 사용.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 관리자 로그인/재발급이 3초 이내 완료된다.
- **SC-002**: 슈퍼 어드민 외 관리자 생성 요청은 403을 반환한다.
- **SC-003**: 대시보드 요약/차트가 기간/필터에 맞는 데이터로 응답한다.
- **SC-004**: 유저 관리 API로 차단/탈퇴가 DB에 반영된다.
