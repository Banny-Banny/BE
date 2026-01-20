# Feature Specification: Admin Products Basic CRUD

**Feature Branch**: `025-admin-products-basic-crud`  
**Created**: 2026-01-20  
**Status**: Draft  
**Input**: User description: "상품 기본 관리 (Basic CRUD): 상품 등록/리스트/상세/수정/삭제(soft delete)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 상품 등록 (Priority: P1)

관리자는 신규 상품을 등록해 판매 준비를 하고 싶다.

**Why this priority**: 판매 정책/가격 변경의 출발점이며 운영에 필수.

**Independent Test**: 인증된 관리자 계정으로 `POST /api/admin/products` 호출 시 상품이 생성된다.

**Acceptance Scenarios**:

1. **Given** 관리자 인증이 유효할 때, **When** 상품 생성 API를 호출하면, **Then** 생성된 상품 정보를 반환한다.
2. **Given** 필수 값(name, price)이 누락되면, **When** API를 호출하면, **Then** 400 에러를 반환한다.

---

### User Story 2 - 상품 리스트 조회/검색/필터 (Priority: P1)

관리자는 상품 목록을 페이지네이션, 카테고리/판매상태 필터, 상품명 검색으로 조회하고 싶다.

**Why this priority**: 운영자가 빠르게 원하는 상품을 찾아 관리하기 위해 필요.

**Independent Test**: `GET /api/admin/products?limit=20&offset=0&search=캡슐` 호출 시 결과가 필터링된다.

**Acceptance Scenarios**:

1. **Given** 검색어가 있을 때, **When** 리스트 API를 호출하면, **Then** 상품명 기준으로 부분일치 검색 결과를 반환한다.
2. **Given** 판매상태 필터가 있을 때, **When** 리스트 API를 호출하면, **Then** 상태에 맞는 상품만 반환한다.

---

### User Story 3 - 상품 상세 조회 (Priority: P1)

관리자는 수정 화면에 필요한 상품의 모든 정보를 조회하고 싶다.

**Independent Test**: `GET /api/admin/products/:id` 호출 시 상품 상세가 반환된다.

---

### User Story 4 - 상품 정보 수정 (Priority: P1)

관리자는 가격, 설명, 이미지 등을 업데이트하고 싶다.

**Independent Test**: `PATCH /api/admin/products/:id` 호출 시 변경된 값이 저장된다.

---

### User Story 5 - 상품 삭제 (Soft Delete) (Priority: P1)

관리자는 실수 방지를 위해 상품을 소프트 삭제하고 싶다.

**Independent Test**: `DELETE /api/admin/products/:id` 호출 시 상품이 삭제 처리된다.

---

### Edge Cases

- 수정 요청에 변경 필드가 하나도 없는 경우는 어떻게 처리하는가?
- 이미 삭제된 상품을 삭제하려고 하면 어떻게 응답하는가?
- 상품 유형이 EASTER_EGG일 때 미디어 제한 값이 누락되면 어떻게 처리하는가?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 시스템은 관리자 인증이 유효한 경우에만 상품 CRUD를 허용해야 한다.
- **FR-002**: 시스템은 상품 생성 시 name, price를 필수로 받아 저장해야 한다.
- **FR-003**: 시스템은 상품 리스트 조회에 페이지네이션(limit, offset)을 제공해야 한다.
- **FR-004**: 시스템은 상품 리스트 조회에 카테고리/판매상태 필터 및 상품명 검색을 제공해야 한다.
- **FR-005**: 시스템은 상품 상세 조회 시 삭제된 상품도 조회 가능해야 한다(관리자용).
- **FR-006**: 시스템은 상품 수정 시 변경된 필드만 업데이트해야 한다.
- **FR-007**: 시스템은 상품 삭제 시 soft delete를 수행해야 한다.

### Key Entities *(include if feature involves data)*

- **Product**: 상품 정보(이름, 가격, 설명, 썸네일, 카테고리, 판매 상태, 삭제일 등)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 상품 리스트 API가 페이지네이션 정보를 포함한다.
- **SC-002**: 상품 삭제 시 실제 레코드는 유지되며 `deleted_at`이 설정된다.
- **SC-003**: 인증되지 않은 요청은 401/403으로 차단된다.
