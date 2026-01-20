# Feature Specification: 공지사항(Notice) CRUD + 상단 고정

**Feature Branch**: `[022-notice]`  
**Created**: 2026-01-20  
**Status**: Draft  
**Input**: User description: "공지사항(Notice) CRUD, 검색, 상단 고정 기능 추가"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 공지사항 작성 (Priority: P1)

관리자는 공지사항 제목/본문/이미지/상단 고정 여부를 입력하여 공지사항을 등록한다.

**Why this priority**: 운영 공지 노출의 핵심 기능이므로 P1.  
**Independent Test**: `POST /admin/notices` → 201, 생성된 공지 ID 반환.

**Acceptance Scenarios**:
1. **Given** 관리자 인증, **When** `/admin/notices` POST, **Then** 공지사항이 생성되고 상세 정보가 반환된다.
2. **Given** 필수값 누락, **When** `/admin/notices` POST, **Then** 400 에러를 반환한다.

---

### User Story 2 - 공지사항 리스트 조회/검색 (Priority: P1)

사용자는 공지사항 목록을 조회하고 키워드로 검색할 수 있다. 상단 고정 공지는 리스트 상단에 노출된다.

**Why this priority**: 공지 전달의 기본 사용자 경험이므로 P1.  
**Independent Test**: `GET /notices?search=키워드&limit=20&offset=0` → 200.

**Acceptance Scenarios**:
1. **Given** 노출 중인 공지, **When** `/notices` 요청, **Then** 상단 고정 공지가 먼저 반환된다.
2. **Given** 검색어, **When** `/notices?search=키워드` 요청, **Then** 제목/본문에 키워드가 포함된 공지만 반환된다.

---

### User Story 3 - 공지사항 상세 조회 (Priority: P1)

사용자는 특정 공지사항 상세 내용을 조회한다.

**Why this priority**: 공지 상세 확인 기능이므로 P1.  
**Independent Test**: `GET /notices/:id` → 200.

**Acceptance Scenarios**:
1. **Given** 노출 중인 공지 ID, **When** `/notices/:id` 요청, **Then** 공지 상세를 반환한다.
2. **Given** 존재하지 않거나 비노출 공지, **When** `/notices/:id` 요청, **Then** 404 에러를 반환한다.

---

### User Story 4 - 공지사항 수정/삭제 (Priority: P1)

관리자는 공지사항의 내용 및 노출 여부를 수정하거나 공지사항을 삭제한다.

**Why this priority**: 운영 정책 변경 및 노출 관리에 필수이므로 P1.  
**Independent Test**: `PATCH /admin/notices/:id`, `DELETE /admin/notices/:id`.

**Acceptance Scenarios**:
1. **Given** 관리자 인증, **When** `/admin/notices/:id` PATCH, **Then** 공지 내용/노출 여부가 변경된다.
2. **Given** 관리자 인증, **When** `/admin/notices/:id` DELETE, **Then** 공지가 삭제된다.

---

### Edge Cases

- 상단 고정 공지가 여러 개일 때 최신 생성 순으로 정렬.
- 수정 요청에서 변경 필드가 없을 경우 400 반환.
- 삭제된 공지는 리스트/상세에 노출되지 않음.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `POST /admin/notices`는 제목/본문/이미지/상단 고정/노출 여부를 저장한다.
- **FR-002**: `GET /notices`는 전체 조회 및 검색을 지원한다.
- **FR-003**: `GET /notices/:id`는 특정 공지 상세를 반환한다.
- **FR-004**: `PATCH /admin/notices/:id`는 공지 내용을 수정하고 노출 여부를 변경한다.
- **FR-005**: `DELETE /admin/notices/:id`는 공지사항을 삭제한다.
- **FR-006**: 상단 고정 공지는 리스트 상단에 우선 노출된다.

### Key Entities *(include if feature involves data)*

- **Notice (`notices`)**: `title`, `content`, `image_url`, `is_pinned`, `is_visible`, `created_at`, `updated_at`, `deleted_at`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 공지 작성/수정/삭제 API가 3초 이내 응답한다.
- **SC-002**: 상단 고정 공지가 리스트 상단에 노출된다.
- **SC-003**: 비노출 공지는 상세/리스트에서 조회되지 않는다.
