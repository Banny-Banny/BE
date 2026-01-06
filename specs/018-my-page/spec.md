# Feature Specification: My Page (마이페이지)

**Feature Branch**: `[018-my-page]`  
**Created**: 2026-01-06  
**Status**: Draft  
**Input**: User description: "마이페이지 엔드포인트 - 프로필 관리, 친구 관리, 타임캡슐 참여 내역, 알림 관리"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 내 프로필 조회 및 수정 (Priority: P1)

사용자는 마이페이지에서 자신의 프로필 정보(닉네임, 프로필 이미지, 이메일, 전화번호)를 조회하고, 닉네임과 프로필 이미지를 수정할 수 있다.

**Why this priority**: 사용자 계정 관리의 핵심 기능으로, 마이페이지의 기본 가치를 제공한다.

**Independent Test**: GET 요청으로 내 정보를 조회하고, PATCH 요청으로 닉네임/프로필 이미지를 수정한 후 다시 조회하여 변경사항이 반영되었는지 확인.

**Acceptance Scenarios**:

1. **Given** 로그인된 사용자가 있고, **When** `GET /api/me` 를 호출하면, **Then** 사용자의 id, nickname, email, phoneNumber, profileImg, isPushAgreed, isMarketingAgreed 정보가 반환된다.
2. **Given** 로그인된 사용자가 있고, **When** `PATCH /api/me` 로 nickname을 수정하면, **Then** 닉네임이 업데이트되고 200이 반환된다.
3. **Given** 로그인된 사용자가 있고, **When** `POST /api/me/profile-image` 로 프로필 이미지 업로드 URL을 요청하면, **Then** S3 presigned URL이 반환되고, 업로드 후 프로필 이미지 URL이 저장된다.
4. **Given** 닉네임이 중복되거나 유효하지 않을 때, **When** 프로필 수정 요청을 하면, **Then** 400 에러가 반환된다.

---

### User Story 2 - 참여중인 타임캡슐 리스트 조회 (Priority: P1)

사용자는 자신이 참여중인 타임캡슐 목록을 조회하여 캡슐 상태(작성중, 오픈 대기중, 오픈됨)를 확인할 수 있다.

**Why this priority**: 사용자가 작성한/참여한 캡슐을 관리하고 추적할 수 있는 핵심 기능이다.

**Independent Test**: GET 요청으로 참여중인 캡슐 리스트를 조회하고, 각 캡슐의 제목, 상태, 오픈일, 참여자 수가 반환되는지 확인.

**Acceptance Scenarios**:

1. **Given** 사용자가 여러 타임캡슐에 참여하고 있을 때, **When** `GET /api/me/capsules` 를 호출하면, **Then** 참여중인 캡슐 리스트(제목, 상태, 오픈일, 참여자 수, 내 작성 상태)가 반환된다.
2. **Given** 사용자가 캡슐 소유자이거나 참여자일 때, **When** 캡슐 리스트를 조회하면, **Then** 두 유형의 캡슐이 모두 포함되어 반환된다.
3. **Given** 사용자가 참여한 캡슐이 없을 때, **When** 캡슐 리스트를 조회하면, **Then** 빈 배열이 반환된다.
4. **Given** 페이지네이션이 필요할 때, **When** `limit`, `offset` 파라미터를 전달하면, **Then** 페이지네이션된 결과가 반환된다.

---

### User Story 3 - 친구 관리 (Priority: P2)

사용자는 친구 목록을 조회하고, 전화번호로 친구를 추가하거나 삭제할 수 있다.

**Why this priority**: 타임캡슐 공유 및 소셜 기능의 기반이 되는 중요한 기능이다.

**Independent Test**: 친구 목록 조회, 친구 추가, 친구 삭제 API를 순차적으로 호출하여 각 동작이 정상적으로 수행되는지 확인.

**Acceptance Scenarios**:

1. **Given** 로그인된 사용자가 있을 때, **When** `GET /api/me/friends` 를 호출하면, **Then** 친구 목록(id, nickname, profileImg, status)이 반환된다.
2. **Given** 로그인된 사용자가 있고, **When** `POST /api/me/friends` 로 전화번호를 전달하면, **Then** 해당 전화번호의 사용자가 친구로 추가되고(PENDING 또는 ACCEPTED), 201이 반환된다.
3. **Given** 친구 관계가 존재할 때, **When** `DELETE /api/me/friends/:friendshipId` 를 호출하면, **Then** 친구 관계가 삭제되고 204가 반환된다.
4. **Given** 존재하지 않는 전화번호로 친구 추가 요청을 할 때, **When** 요청을 보내면, **Then** 404 에러가 반환된다.
5. **Given** 이미 친구 관계가 존재할 때, **When** 중복 친구 추가 요청을 하면, **Then** 409 에러가 반환된다.
6. **Given** 자기 자신의 전화번호로 친구 추가 요청을 할 때, **When** 요청을 보내면, **Then** 400 에러가 반환된다.

---

### User Story 4 - 알림 설정 관리 (Priority: P2)

사용자는 푸시 알림 수신 동의/거절을 설정하고, 마케팅 알림 수신 동의/거절을 설정할 수 있다.

**Why this priority**: 사용자 경험과 개인정보 보호를 위한 필수 설정 기능이다.

**Independent Test**: PATCH 요청으로 알림 동의 상태를 변경하고, GET 요청으로 변경사항이 반영되었는지 확인.

**Acceptance Scenarios**:

1. **Given** 로그인된 사용자가 있을 때, **When** `PATCH /api/me/settings` 로 `isPushAgreed: false` 를 전달하면, **Then** 푸시 알림이 비활성화되고 200이 반환된다.
2. **Given** 로그인된 사용자가 있을 때, **When** `PATCH /api/me/settings` 로 `isMarketingAgreed: true` 를 전달하면, **Then** 마케팅 알림이 활성화되고 200이 반환된다.
3. **Given** 사용자 설정이 변경된 후, **When** `GET /api/me` 를 호출하면, **Then** 변경된 설정이 반영되어 반환된다.

---

### User Story 5 - 알림 조회 및 관리 (Priority: P3)

사용자는 최근 알림 리스트를 조회하고, 읽지 않은 알림 개수를 확인하며, 알림을 읽음 처리할 수 있다.

**Why this priority**: 사용자 참여를 높이고 중요한 이벤트를 놓치지 않게 하는 부가 기능이다.

**Independent Test**: 알림 생성 후 알림 목록 조회, 읽지 않은 개수 조회, 읽음 처리 API를 순차적으로 호출하여 정상 동작을 확인.

**Acceptance Scenarios**:

1. **Given** 사용자에게 알림이 있을 때, **When** `GET /api/me/notifications` 를 호출하면, **Then** 알림 리스트(제목, 내용, 타입, 읽음 상태, 생성일)가 반환된다.
2. **Given** 사용자에게 읽지 않은 알림이 있을 때, **When** `GET /api/me/notifications/unread-count` 를 호출하면, **Then** 읽지 않은 알림 개수가 반환된다.
3. **Given** 읽지 않은 알림이 있을 때, **When** `PATCH /api/me/notifications/:notificationId/read` 를 호출하면, **Then** 알림이 읽음 처리되고 200이 반환된다.
4. **Given** 페이지네이션이 필요할 때, **When** `limit`, `offset` 파라미터를 전달하면, **Then** 페이지네이션된 알림 목록이 반환된다.
5. **Given** 알림이 이미 읽음 상태일 때, **When** 다시 읽음 처리 요청을 하면, **Then** 200이 반환되고 상태는 변경되지 않는다(멱등성).

---

### User Story 6 - 알림 메시지 발송 (관리자 기능) (Priority: P3)

관리자는 특정 사용자 또는 전체 사용자에게 알림 메시지를 발송할 수 있다.

**Why this priority**: 운영 및 마케팅을 위한 관리자 기능으로, 우선순위가 낮다.

**Independent Test**: 관리자 권한으로 알림 발송 API를 호출하고, 대상 사용자가 알림을 수신했는지 확인.

**Acceptance Scenarios**:

1. **Given** 관리자 권한이 있을 때, **When** `POST /api/admin/notifications` 로 알림 내용과 대상 사용자를 전달하면, **Then** 알림이 생성되고 201이 반환된다.
2. **Given** 관리자 권한이 없을 때, **When** 알림 발송 요청을 하면, **Then** 403 에러가 반환된다.
3. **Given** 전체 사용자 대상으로 알림 발송 요청을 할 때, **When** `targetType: 'ALL'` 로 요청하면, **Then** 모든 활성 사용자에게 알림이 생성된다.

---

### Edge Cases

- 프로필 이미지 업로드 시 허용되지 않은 파일 형식이나 크기 초과
- 닉네임 변경 시 중복 또는 금지어 포함
- 친구 추가 시 이미 친구이거나 차단된 관계
- 친구 삭제 시 존재하지 않는 friendship ID
- 알림 조회 시 삭제된 알림 또는 다른 사용자의 알림 접근 시도
- 읽지 않은 알림 개수가 음수가 되지 않도록 보장
- 동시에 여러 알림을 읽음 처리하는 경우의 동시성 이슈

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 시스템은 `GET /api/me` 요청 시 로그인된 사용자의 프로필 정보(id, nickname, email, phoneNumber, profileImg, isPushAgreed, isMarketingAgreed, eggSlots, createdAt)를 반환해야 한다.
- **FR-002**: 시스템은 `PATCH /api/me` 요청으로 nickname, email 필드를 수정할 수 있어야 하며, 중복 닉네임은 400으로 거절해야 한다.
- **FR-003**: 시스템은 `POST /api/me/profile-image` 요청 시 S3 presigned URL을 반환하고, 업로드 완료 후 사용자의 profileImg 필드를 업데이트해야 한다.
- **FR-004**: 프로필 이미지는 `image/jpeg|image/png|image/webp` 형식만 허용하고, 최대 5MB까지 허용해야 한다. 위반 시 400을 반환한다.
- **FR-005**: 시스템은 `GET /api/me/capsules` 요청 시 사용자가 소유하거나 참여중인 타임캡슐 리스트를 반환해야 한다. 각 캡슐에는 id, title, status, openDate, participantCount, myWriteStatus가 포함된다.
- **FR-006**: 캡슐 리스트는 최신순으로 정렬되고, `limit`, `offset` 파라미터로 페이지네이션을 지원해야 한다.
- **FR-007**: 시스템은 `GET /api/me/friends` 요청 시 친구 목록(id, userId, friendId, status, user/friend 프로필 정보)을 반환해야 한다.
- **FR-008**: 시스템은 `POST /api/me/friends` 요청으로 전화번호를 받아 해당 사용자를 친구로 추가해야 한다. 친구 관계는 `user_id < friend_id` 정책을 따라 저장한다.
- **FR-009**: 친구 추가 시 자기 자신을 추가하려는 경우 400, 존재하지 않는 전화번호는 404, 이미 친구 관계가 있으면 409를 반환해야 한다.
- **FR-010**: 시스템은 `DELETE /api/me/friends/:friendshipId` 요청으로 친구 관계를 삭제해야 한다. 본인이 속한 friendship만 삭제 가능하며, 권한 없으면 403을 반환한다.
- **FR-011**: 시스템은 `PATCH /api/me/settings` 요청으로 `isPushAgreed`, `isMarketingAgreed` 필드를 수정할 수 있어야 한다.
- **FR-012**: 시스템은 `GET /api/me/notifications` 요청 시 사용자의 알림 리스트를 반환해야 한다. 알림은 최신순으로 정렬되고 `limit`, `offset`으로 페이지네이션을 지원한다.
- **FR-013**: 알림 객체는 id, userId, title, content, type(CAPSULE_OPEN, FRIEND_REQUEST, SYSTEM 등), isRead, createdAt 필드를 포함해야 한다.
- **FR-014**: 시스템은 `GET /api/me/notifications/unread-count` 요청 시 읽지 않은 알림 개수를 반환해야 한다.
- **FR-015**: 시스템은 `PATCH /api/me/notifications/:notificationId/read` 요청으로 알림을 읽음 처리해야 한다. 다른 사용자의 알림은 403으로 거절한다.
- **FR-016**: 시스템은 `POST /api/admin/notifications` 요청(관리자 전용)으로 알림을 생성하고 대상 사용자에게 발송해야 한다. targetType이 'USER'면 userId 필요, 'ALL'이면 전체 활성 사용자 대상.
- **FR-017**: 관리자 알림 발송 시 관리자 권한이 없으면 403을 반환해야 한다.
- **FR-018**: 알림 타입은 `CAPSULE_OPEN`, `FRIEND_REQUEST`, `FRIEND_ACCEPTED`, `SYSTEM`, `MARKETING` 등을 지원해야 한다. [NEEDS CLARIFICATION: 추가 알림 타입 정의 필요]
- **FR-019**: 친구 관계의 status는 `PENDING`, `ACCEPTED`, `BLOCKED` 중 하나여야 한다. 현재는 양방향 자동 수락으로 구현하되, 향후 승인 흐름 추가 가능성 있음. [NEEDS CLARIFICATION: 친구 요청 승인 흐름 필요 여부]

### Key Entities

- **User**: 사용자 기본 정보. nickname, email, phoneNumber, profileImg, isPushAgreed, isMarketingAgreed 등의 속성을 가진다.
- **Friendship**: 사용자 간 친구 관계. userId, friendId, status(PENDING/ACCEPTED/BLOCKED), 생성/수정일을 포함한다.
- **Notification**: 사용자에게 발송되는 알림. userId, title, content, type, isRead, createdAt 필드를 가진다.
- **CapsuleParticipantSlot**: 사용자가 참여중인 캡슐의 슬롯 정보. 사용자의 캡슐 참여 여부를 확인하는 데 사용된다.
- **Capsule**: 타임캡슐 메타데이터. 사용자가 소유하거나 참여중인 캡슐 목록을 조회하는 데 사용된다.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `GET /api/me` 요청에 대해 95퍼센트타일 응답 시간이 200ms 이하.
- **SC-002**: 프로필 수정 요청에 대해 중복 닉네임, 유효하지 않은 데이터에 대해 100% 적절한 에러 응답 반환.
- **SC-003**: 참여중인 캡슐 리스트 조회 시 소유 캡슐과 참여 캡슐이 모두 100% 포함됨.
- **SC-004**: 친구 추가 시 자기 자신, 중복, 존재하지 않는 사용자에 대해 100% 적절한 에러 반환.
- **SC-005**: 읽지 않은 알림 개수가 항상 실제 읽지 않은 알림 수와 100% 일치.
- **SC-006**: 알림 읽음 처리 시 다른 사용자의 알림 접근을 100% 차단(403).
- **SC-007**: 프로필 이미지 업로드 시 허용되지 않은 형식/크기는 100% 거절(400).
- **SC-008**: 관리자 알림 발송 기능이 권한 없는 사용자에게 100% 차단됨(403).

