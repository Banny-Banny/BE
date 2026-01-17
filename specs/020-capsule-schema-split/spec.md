# Feature Specification: 캡슐 스키마 분리 및 유저 name 컬럼

**Feature Branch**: `[020-capsule-schema-split]`  
**Created**: 2026-01-17  
**Status**: Draft  
**Input**: User description: "캡슐 테이블에 혼재된 이스터에그/타임캡슐 및 결제 관련 데이터를 관심사 기준으로 분리하고, 유저 name 컬럼을 추가"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 이스터에그/타임캡슐 데이터 분리 (Priority: P1)

운영자는 캡슐 공통 데이터와 타입별 데이터를 분리하여 중복을 제거하고, 조회/생성 로직이 명확히 분리된 상태를 유지한다.

**Why this priority**: 핵심 데이터 구조 변경으로 전체 캡슐 흐름에 영향이 크므로 P1.  
**Independent Test**: 기존 캡슐 생성/조회 API 호출 시 기존 응답이 유지되고, DB에 타입별 테이블이 올바르게 채워진다.

**Acceptance Scenarios**:
1. **Given** 이스터에그 캡슐 생성, **When** `capsules` 조회, **Then** `capsules`는 공통 데이터만 저장하고 `easter_eggs`에 타입별 데이터가 저장된다.
2. **Given** 결제 완료된 타임캡슐 생성, **When** 대기실/상세 조회, **Then** `time_capsules`에 타입별 데이터가 저장되고 order와 매칭된다.

---

### User Story 2 - 결제/비결제 데이터 분리 (Priority: P1)

결제에 의해 생성되는 데이터는 결제/주문 테이블과의 관계로 관리되고, 무료/비결제 데이터와 스키마가 분리된다.

**Why this priority**: 재무 데이터 무결성과 도메인 경계가 중요하므로 P1.  
**Independent Test**: 주문-결제-타임캡슐 연결 관계가 유지되고, 무료 캡슐은 결제 데이터 없이도 정상 동작한다.

**Acceptance Scenarios**:
1. **Given** 결제 완료 주문, **When** 타임캡슐 생성, **Then** `time_capsules.order_id`는 주문과 1:1로 매칭된다.
2. **Given** 무료 이스터에그, **When** 조회/로그 기록, **Then** 결제 관련 컬럼 없이도 동작한다.

---

### User Story 3 - 유저 name 컬럼 추가 (Priority: P2)

운영자는 유저의 표시용 닉네임과 별개로 name 컬럼을 보유하고 조회할 수 있다.

**Why this priority**: 사용자 프로필 확장에 필요하지만 핵심 흐름은 아니므로 P2.  
**Independent Test**: 유저 엔티티에 `name` 컬럼이 추가되고 마이그레이션 적용 후 조회 가능하다.

**Acceptance Scenarios**:
1. **Given** 유저 데이터, **When** DB 조회, **Then** `users.name` 컬럼이 존재하고 null 허용이다.

---

### Edge Cases

- 기존 캡슐 데이터 마이그레이션 시 타입 판단이 불명확한 케이스는 `capsule_type` 기준값으로 처리.
- 주문이 없는 타임캡슐 생성 경로는 명시적으로 차단하거나 별도 정책으로 처리.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `capsules`에는 공통 데이터만 저장하고 타입별 데이터는 `time_capsules` 또는 `easter_eggs`에 저장한다.
- **FR-002**: 결제 기반 데이터는 `orders/payments`와 1:1로 매칭되며 중복 저장하지 않는다.
- **FR-003**: 기존 API 응답 스키마는 유지한다.
- **FR-004**: `users` 테이블에 `name` 컬럼을 추가한다.

### Key Entities *(include if feature involves data)*

- **Capsule (`capsules`)**: 공통 데이터 + `capsule_type`.
- **TimeCapsule (`time_capsules`)**: 결제 기반 데이터 및 대기실 관련 메타.
- **EasterEgg (`easter_eggs`)**: 이스터에그 전용 제한/조회 데이터.
- **User (`users`)**: `name` 컬럼 추가.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 신규/기존 캡슐 생성/조회 API가 정상 동작한다.
- **SC-002**: 마이그레이션 후 데이터 손실 없이 타입별 테이블로 분리된다.
- **SC-003**: `users.name` 컬럼이 존재하고 기본 응답에 영향이 없다.
