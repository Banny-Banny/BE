# Feature Specification: 1:1 문의 (Inquiry - Chat)

**Feature Branch**: `[021-inquiry-chat]`  
**Created**: 2026-01-19  
**Status**: Draft  
**Input**: User description: "문의 채팅방 리스트/이력은 HTTP API, 실시간 대화는 WebSocket으로 분리"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 관리자 문의 리스트 조회 (Priority: P1)

관리자는 문의 채팅방을 상태별로 필터링하고 최신 메시지 기준으로 조회한다.

**Why this priority**: 운영 대응의 출발점이므로 P1.  
**Independent Test**: `GET /admin/inquiries?status=PENDING`.

**Acceptance Scenarios**:
1. **Given** 문의 데이터 존재, **When** `/admin/inquiries` 요청, **Then** 최신 메시지 순으로 목록을 반환한다.
2. **Given** 상태 필터, **When** `status=COMPLETED`, **Then** 완료된 방만 반환한다.

---

### User Story 2 - 문의 상세 이력 조회 (Priority: P1)

관리자는 특정 채팅방의 대화 이력을 페이지네이션으로 확인한다.

**Why this priority**: 고객 대응에 필요하므로 P1.  
**Independent Test**: `GET /admin/inquiries/:id?limit=20&offset=0`.

**Acceptance Scenarios**:
1. **Given** 유효한 문의 ID, **When** 상세 조회, **Then** 메시지 목록과 메타 정보를 반환한다.
2. **Given** 페이지네이션 파라미터, **When** `offset` 증가, **Then** 다음 페이지 메시지를 반환한다.

---

### User Story 3 - 문의 상태 변경 (Priority: P2)

관리자는 문의 상태(대기/진행/보류/완료)를 변경한다.

**Why this priority**: 운영 상태 관리를 위해 P2.  
**Independent Test**: `PATCH /admin/inquiries/:id/status`.

**Acceptance Scenarios**:
1. **Given** 유효한 방, **When** 상태 변경, **Then** 상태가 갱신된다.

---

### User Story 4 - 실시간 채팅 (Priority: P1)

관리자와 유저는 WebSocket으로 실시간 메시지를 주고받는다.

**Why this priority**: 실시간 응대가 핵심 기능이므로 P1.  
**Independent Test**: `/admin-chat` 및 `/user-chat` namespace 연결 후 `send_message`.

**Acceptance Scenarios**:
1. **Given** 인증된 관리자, **When** `send_message`, **Then** 유저가 `receive_message`로 수신한다.
2. **Given** 인증된 유저, **When** `send_message`, **Then** 관리자가 `receive_message`로 수신한다.

---

### User Story 5 - 문의 삭제/메시지 수정 (Priority: P3)

관리자는 문의방 또는 메시지를 삭제하거나(soft delete), 관리자 메시지를 수정한다.

**Why this priority**: 법적/운영 이슈 대응을 위해 P3.  
**Independent Test**: `DELETE /admin/inquiries/:id`, `PUT /admin/inquiries/:id/messages/:messageId`.

**Acceptance Scenarios**:
1. **Given** 유효한 방, **When** 삭제 요청, **Then** 소프트 삭제 처리된다.
2. **Given** 관리자 메시지, **When** 수정 요청, **Then** 내용이 변경된다.

---

### Edge Cases

- 삭제된 문의방/메시지 접근 시 404 반환.
- 상태 변경 시 잘못된 상태 값은 400 반환.
- 인증 실패 시 WebSocket 연결 거부.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `GET /admin/inquiries`는 상태 필터와 최신순 정렬을 지원한다.
- **FR-002**: `GET /admin/inquiries/:id`는 메시지 이력 페이지네이션을 반환한다.
- **FR-003**: `PATCH /admin/inquiries/:id/status`로 문의 상태를 변경한다.
- **FR-004**: `DELETE /admin/inquiries/:id`는 문의방을 soft delete 처리한다.
- **FR-005**: `DELETE /admin/inquiries/:id/messages/:messageId`는 메시지를 soft delete 처리한다.
- **FR-006**: `PUT /admin/inquiries/:id/messages/:messageId`는 관리자 메시지를 수정한다.
- **FR-007**: WebSocket `/admin-chat` 및 `/user-chat`은 `join_room`, `leave_room`, `send_message`, `receive_message`, `read_alert` 이벤트를 지원한다.

### Key Entities *(include if feature involves data)*

- **CustomerService (`customer_services`)**: 문의 채팅방 메타데이터 및 상태 관리.
- **CustomerServiceMessage (`customer_service_messages`)**: 실시간 메시지 이력 저장.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 문의 리스트는 최신 메시지 기준 정렬로 반환된다.
- **SC-002**: 실시간 메시지는 1초 내 상대방에게 전달된다.
- **SC-003**: 상태 변경/삭제/수정 요청이 DB에 반영된다.
