# Feature Specification: Admin User Join/Withdraw Trends

**Feature Branch**: `024-admin-user-trends`  
**Created**: 2026-01-20  
**Status**: Draft  
**Input**: User description: "최근 90일 가입/탈퇴 추이를 바 차트로 그리기 위한 데이터를 제공하는 API를 admin dashboard에서 사용"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 최근 90일 가입/탈퇴 추이 조회 (Priority: P1)

관리자는 대시보드에서 최근 90일의 가입/탈퇴 추이를 날짜별로 확인하고 싶다.

**Why this priority**: 대시보드 핵심 지표이며 다른 기능보다 우선적으로 필요하다.

**Independent Test**: 인증된 관리자 계정으로 `GET /api/admin/dashboard/user-trends?period=90d` 호출 시 날짜별 joined/withdrawn 배열이 반환된다.

**Acceptance Scenarios**:

1. **Given** 관리자 인증이 유효할 때, **When** 최근 90일 추이 API를 호출하면, **Then** 오늘까지의 날짜가 연속적으로 포함된 배열을 반환한다.
2. **Given** 특정 날짜에 가입/탈퇴 데이터가 없을 때, **When** API를 호출하면, **Then** 해당 날짜는 joined=0, withdrawn=0 으로 포함된다.

---

### User Story 2 - 기간 파라미터 유효성 처리 (Priority: P2)

관리자는 요청 시 기간을 변경할 수 있고, 서버는 허용되지 않은 값에 대해 명확히 응답한다.

**Why this priority**: 잘못된 요청을 빠르게 디버깅하고 API 안정성을 보장한다.

**Independent Test**: `period` 값이 허용되지 않으면 400 에러와 메시지를 반환한다.

**Acceptance Scenarios**:

1. **Given** period가 누락되거나 허용되지 않는 값일 때, **When** API 호출하면, **Then** 400 에러를 반환한다.

---

### Edge Cases

- period 값이 대소문자 혼합 또는 공백을 포함하는 경우는 어떻게 처리하는가?
- 시스템 시간이 UTC가 아닐 때 날짜 경계는 어떻게 계산하는가?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 시스템은 `period=90d` 요청에 대해 최근 90일(오늘 포함) 날짜별 가입 수를 반환해야 한다.
- **FR-002**: 시스템은 `period=90d` 요청에 대해 최근 90일(오늘 포함) 날짜별 탈퇴 수를 반환해야 한다.
- **FR-003**: 응답은 날짜 오름차순 배열이며 각 항목은 `date`, `joined`, `withdrawn` 필드를 포함해야 한다.
- **FR-004**: 데이터가 없는 날짜는 `joined=0`, `withdrawn=0` 으로 채워져야 한다.
- **FR-005**: 인증된 관리자만 접근 가능해야 한다.

### Key Entities *(include if feature involves data)*

- **User**: 가입일(createdAt), 탈퇴일(withdrawnAt 또는 deletedAt/soft delete) 정보를 기준으로 집계

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 최근 90일 요청 시 정확히 90개의 날짜 레코드가 반환된다.
- **SC-002**: 빈 날짜가 누락되지 않는다(모든 날짜가 연속적으로 포함).
- **SC-003**: 인증 없는 요청은 차단된다(401 또는 403).
