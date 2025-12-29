# Feature Specification: 자체 로그인/회원가입/로그아웃

**Feature Branch**: `[011-local-auth]`  
**Created**: 2025-12-28  
**Status**: Draft  
**Input**: User description: "자체 로그인 회원가입 로그아웃 기능 만들어 speckit 을 활용해서, 내 디비 구조에 맞게 기능 명세 작성해"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 자체 회원가입 (Priority: P1)

회원은 휴대폰 번호, 닉네임, 비밀번호(및 선택적 이메일/프로필)를 입력하여 `LOCAL` 제공자로 가입하고, 즉시 JWT access token을 발급받아 인증된 상태가 된다.

**Why this priority**: 로컬 인증은 ID/패스워드 기반 회원 확보/기존 회원 전환을 위한 기반이며, 회원 기능에서 가장 먼저 개발되는 흐름이다.  
**Independent Test**: `POST /auth/local/signup` 요청 → HTTP 201 + 토큰/유저 정보를 받고, `users` 테이블에 새로운 행이 생기는지 확인하면 검증 가능.

**Acceptance Scenarios**:
1. **Given** 신규 회원이 등록되지 않은 `phone_number` 로 요청, **When** 필요한 필드와 함께 `/auth/local/signup` 을 호출하면, **Then** `users` 테이블에 유저가 생성되고 `provider='LOCAL'`, `is_active=true`, `password_hash` 가 저장되며 access token이 반환된다.
2. **Given** 중복된 `phone_number` 또는 `email` 이 존재, **When** 같은 값으로 가입 시도하면, **Then** 409 또는 400 에러와 함께 원인 메시지를 응답한다.
3. **Given** 비밀번호가 짧거나 필수 항목 누락, **When** 요청하면, **Then** 400 에러와 입력 유효성 메시지를 반환한다.

---

### User Story 2 - 자체 로그인 (Priority: P1)

기존 로컬 회원은 `phone_number` 또는 `email` 과 비밀번호로 인증하여 JWT access token을 받는다.

**Why this priority**: 로그인 없이는 타임캡슐 생성/조회/결제 불가하므로 P1.  
**Independent Test**: `POST /auth/local/login` 요청 → 등록된 사용자면 200 + 토큰, 그렇지 않으면 401.

**Acceptance Scenarios**:
1. **Given** 올바른 `phone_number`+`password` 또는 `email`+`password`, **When** `/auth/local/login` 요청하면, **Then** access token + 최소 유저 정보(닉네임/이메일/프로필 URL) 포함 응답을 받는다.
2. **Given** 틀린 비밀번호 또는 존재하지 않는 계정, **When** 요청하면, **Then** 401 Unauthorized (또는 경고 메시지) 반환.
3. **Given** `is_active=false` 인 회원, **When** 로그인하면, **Then** 403 또는 401 상태와 함께 "탈퇴/정지된 계정" 경고.

---

### User Story 3 - 로그아웃 (Priority: P2)

클라이언트는 저장된 토큰을 서버에 제출하여 로그아웃 처리(토큰 블랙리스트 또는 클라이언트 삭제) 후 다시 인증이 필요한 요청에 실패해야 한다.

**Why this priority**: 보안상 중요한 흐름이나 서비스 품질을 확보하기 위해 P2로 두며 후속 BB 시나리오를 준비.  
**Independent Test**: 토큰으로 `POST /auth/logout` 요청 → 200 OK, 이후 같은 토큰으로 보호된 API 접속 시 401.

**Acceptance Scenarios**:
1. **Given** 유효한 access token, **When** `/auth/logout` 호출, **Then** 토큰 무효화 처리(예: Redis blacklist 또는 DB 저장) 후 200 OK.
2. **Given** 이미 만료되었거나 없는 토큰, **When** 로그아웃 요청, **Then** 401 또는 idempotent 하게 200 처리.
3. **Given** 로그아웃 후, **When** 동일 토큰으로 `/auth/me` 호출, **Then** JwtAuthGuard 에서 실패하여 401.

---

### Edge Cases

- `phone_number` 과 `email` 이 동시에 중복일 때 어느 기준으로 에러를 반환할지 (priority: phone_number).  
- 비밀번호 저장/검증 실패(암호화 미스)시 로그에 민감 정보 없이 기록.  
- 이메일 없이 가입한 사용자가 로그인 시 이메일 키를 선택하면 적용 안 되는 경우.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `POST /auth/local/signup` 은 `nickname`, `phoneNumber`, `password` (선택적 email/profileImg) 로 신규 `users` 레코드를 생성한다.  
- **FR-002**: `phone_number` 와 `email` 은 `users` 테이블에서 유니크를 유지하며, 중복 시 명시적 에러를 낸다.  
- **FR-003**: 비밀번호는 bcrypt 등 적절한 해시함수로 `password_hash` 칼럼에 저장하고, 로그인 시 해시 비교로 검증한다.  
- **FR-004**: `provider` 값은 로컬 회원가입에서 `'LOCAL'` 로 설정하되, 기존 카카오 가입자와 중복된 전화번호를 막기 위해 `provider`/`is_active` 상태를 고려한다.  
- **FR-005**: 로그인(`POST /auth/local/login`)은 `phoneNumber` 또는 `email` + `password` 로만 작동하며, `is_active=false` 유저는 거부한다.  
- **FR-006**: 로그아웃(`POST /auth/logout`) 요청 시 토큰을 블랙리스트하거나 시점 정보를 기록하고, 블랙리스트된 토큰으로는 보호된 API 접근을 막는다.  
- **FR-007**: 모든 엔드포인트는 실패 시 Swagger 정의된 에러 코드(400/401/403/409) 와 메시지를 반환하며, API 문서로 노출한다.  
- **FR-008**: 새로운 칼럼 `password_hash` 와 필요하면 `salt_version` (버전 관리) 를 `users` 테이블에 추가한다.

### Key Entities *(include if feature involves data)*

- **User (`users`)**: 이미 존재하는 `nickname`, `phone_number`, `email`, `profile_img`, `provider`, `is_active`, `egg_slots` 등을 보유하며, 여기에 `password_hash` (varchar 255, null=false) 와 `last_logout_at` 또는 `token_version` 처럼 로그아웃/토큰 무효화를 위한 필드를 추가한다.  
- **Token Blacklist (필요시)**: `token`, `expires_at`, `user_id` 를 저장할 수 있는 간단한 테이블 혹은 Redis 자료 구조로, logout 이후 해당 토큰으로 접근하면 JwtAuthGuard 가 fail.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 로컬 회원가입/로그인은 Swagger 문서에 명시된 입력값으로 5초 내 완료할 수 있어야 하며, 서버는 성능 저하 없이 3초 이내 반응한다.  
- **SC-002**: `phone_number` 중복 요청은 409 Conflict 를 반환하여 클라이언트가 명확하게 처리할 수 있다.  
- **SC-003**: 로그아웃 후 같은 access token 으로 보호된 API 호출을 하면 401 Unauthorized 응답을 지속적으로 받는다.  
- **SC-004**: E2E 테스트 없이도 명세 문서만으로도 `POST /auth/local/signup`, `/auth/local/login`, `/auth/logout` 의 기본 시나리오를 3회 반복해서 성공시키면 다른 팀에서 기능을 동작으로 받아들인다.

