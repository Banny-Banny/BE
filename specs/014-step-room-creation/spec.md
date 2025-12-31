# Feature: 결제 완료 시 대기실(Step Room) 자동 생성

**Feature Branch**: `014-step-room-creation`  
**Created**: 2025-12-31  
**Status**: Draft  
**Input**: 결제 완료 시 대기실 자동 생성 및 초대 코드 발급

## 개요
- 결제가 완료된 주문(PAID)에 대해 타임캡슐 대기실(Step Room)을 자동으로 생성한다.
- 대기실은 초대 코드, 마감시한(deadline), 참여 슬롯을 포함한다.
- 주문 시 설정한 값(인원수, 사진갯수, 옵션)이 대기실 및 캡슐 설정에 반영된다.

## 목표
- 결제 완료 즉시 대기실이 자동 생성되어 친구들을 초대할 수 있는 상태가 된다.
- 대기실에는 고유한 초대 코드가 발급되어 공유가 가능하다.
- 결제 시각 기준 24시간 후 자동으로 마감되는 deadline이 설정된다.
- 주문 시 선택한 인원수만큼 참여 슬롯이 생성된다.

## 비범위
- 대기실 참여자 초대/수락 프로세스는 별도 기능으로 분리한다.
- 미디어 업로드 자체는 기존 흐름을 재사용한다.
- 결제 승인/취소 프로세스 자체는 변경하지 않는다.

## 이해관계자 및 액터
- **Authenticated User** (주문자/방장)
- **System** (주문/결제 상태 갱신, 대기실 생성)
- **Payment Provider** (결제 성공/실패 콜백 제공)

## User Scenarios & Testing

### User Story 1 - 결제 완료 시 대기실 자동 생성 (Priority: P1)

**사용자가 상품을 결제하면, 시스템이 자동으로 친구들을 초대할 수 있는 대기실을 생성한다.**

**Why this priority**: 핵심 기능으로, 결제 후 바로 친구 초대가 가능해야 사용자 경험이 자연스럽다.

**Independent Test**: 결제 완료 API 호출 후 응답에 대기실 정보(room_id, invite_code)가 포함되는지 검증

**Acceptance Scenarios**:

1. **Given** 사용자가 3인용 타임캡슐 상품을 주문하고 결제를 완료했을 때
   **When** 결제 승인 API(`POST /api/payments/approve`)를 호출하면
   **Then** 응답에 생성된 대기실 정보가 포함된다:
   - `room_id`: UUID
   - `invite_code`: 6자리 영숫자 코드
   - `capsule_name`: 주문 시 입력한 캡슐 이름
   - `open_date`: 주문 시 선택한 열람 날짜
   - `deadline`: 결제 완료 시각 + 24시간
   - `created_at`: 대기실 생성 시각

2. **Given** 동일한 주문에 대해 결제 승인을 재시도할 때
   **When** 동일 order_id로 결제 승인을 다시 호출하면
   **Then** 기존에 생성된 대기실 정보를 반환하고 중복 생성하지 않는다

3. **Given** 결제가 실패하거나 대기(PENDING) 상태일 때
   **When** 주문 상태가 PAID가 아니면
   **Then** 대기실을 생성하지 않는다

---

### User Story 2 - 인원수에 맞는 참여 슬롯 자동 생성 (Priority: P1)

**주문 시 선택한 인원수만큼 대기실에 참여 슬롯이 생성되어, 각 참여자가 자신의 콘텐츠를 작성할 수 있다.**

**Why this priority**: 다인용 타임캡슐의 핵심 기능으로, 각 참여자별 콘텐츠 관리가 필요하다.

**Independent Test**: 대기실 생성 후 슬롯 조회 API로 인원수만큼 슬롯이 생성되었는지 확인

**Acceptance Scenarios**:

1. **Given** 사용자가 5인용 타임캡슐을 주문하고 결제를 완료했을 때
   **When** 대기실이 생성되면
   **Then** 5개의 참여 슬롯이 자동으로 생성된다
   - 슬롯 1: 주문자(방장)에게 자동 배정
   - 슬롯 2~5: 초대 대기 상태

2. **Given** 각 슬롯은 주문 시 설정한 미디어 제약을 공유할 때
   **When** 주문에서 `photo_count=10`, `add_music=true`로 설정했다면
   **Then** 모든 슬롯에 동일한 미디어 제약이 적용된다
   - 최대 사진 10장
   - 음악 추가 가능
   - 영상 추가 가능 여부는 주문 옵션 따름

---

### User Story 3 - 초대 코드를 통한 대기실 조회 (Priority: P2)

**친구들이 초대 코드를 입력하면 대기실 정보를 조회하고 참여할 수 있다.**

**Why this priority**: 초대 코드 기반 공유는 사용자 편의성을 높이는 핵심 기능이다.

**Independent Test**: 초대 코드로 대기실 조회 API 호출 시 대기실 정보가 반환되는지 검증

**Acceptance Scenarios**:

1. **Given** 대기실이 생성되고 초대 코드가 발급되었을 때
   **When** `GET /api/capsules/step-rooms?invite_code=ABC123`를 호출하면
   **Then** 대기실 정보가 반환된다:
   - `room_id`, `capsule_name`, `open_date`
   - 현재 참여 인원 / 전체 인원
   - `deadline` (남은 시간)
   - 참여 가능 여부

2. **Given** 존재하지 않는 초대 코드로 조회할 때
   **When** 잘못된 invite_code를 사용하면
   **Then** 404 에러가 반환된다

3. **Given** 마감시한이 지난 대기실을 조회할 때
   **When** deadline이 지난 대기실의 invite_code로 조회하면
   **Then** 200 응답과 함께 "마감됨" 상태가 반환된다

---

### User Story 4 - 24시간 마감시한 자동 설정 (Priority: P2)

**대기실은 결제 완료 후 24시간 내에 모든 참여자가 콘텐츠를 작성해야 한다.**

**Why this priority**: 타임캡슐 작성의 긴박감을 주고, 방치된 대기실을 방지한다.

**Independent Test**: 결제 완료 시각과 deadline 시각 차이가 24시간인지 검증

**Acceptance Scenarios**:

1. **Given** 2025-12-30 13:00:00에 결제가 완료되었을 때
   **When** 대기실이 생성되면
   **Then** `deadline`이 2025-12-31 13:00:00으로 설정된다

2. **Given** deadline이 지난 대기실이 있을 때
   **When** 새로운 콘텐츠 작성을 시도하면
   **Then** 409 Conflict 에러가 반환되고 "마감시한이 지났습니다" 메시지가 표시된다

3. **Given** deadline 전에 모든 참여자가 작성을 완료했을 때
   **When** 마지막 참여자가 제출하면
   **Then** 대기실 상태가 "완료"로 변경되고, 타임캡슐이 잠금 상태로 전환된다

---

### Edge Cases

- **중복 생성 방지**: 동일 주문으로 여러 번 결제 승인 API가 호출될 경우 대기실은 1개만 생성되어야 한다.
- **초대 코드 충돌**: 생성된 초대 코드가 기존 코드와 중복되지 않도록 unique 제약을 적용한다.
- **비활성 상품**: 주문의 상품이 비활성 상태이거나 타임캡슐 상품이 아닌 경우 대기실을 생성하지 않는다.
- **인원수 제약**: 주문의 headcount가 1~10 범위를 벗어나면 대기실 생성을 거부한다.
- **커스텀 열람 날짜**: `time_option=CUSTOM`인데 `custom_open_at`이 없으면 400 에러를 반환한다.
- **타임존 처리**: deadline 계산 시 서버 시간대(UTC)를 기준으로 하되, 클라이언트에는 ISO 8601 형식으로 제공한다.

## Requirements

### Functional Requirements

- **FR-001**: 시스템은 주문 상태가 `PAID`로 전환될 때 대기실을 자동 생성해야 한다.
- **FR-002**: 대기실에는 6자리 영숫자 초대 코드(예: `ABC123`)가 발급되어야 한다.
- **FR-003**: 초대 코드는 시스템 전체에서 고유해야 하며, 대소문자 구분 없이 조회 가능해야 한다.
- **FR-004**: 대기실의 `deadline`은 결제 완료 시각 + 24시간으로 자동 설정되어야 한다.
- **FR-005**: 주문의 `headcount`만큼 참여 슬롯이 자동 생성되어야 한다.
- **FR-006**: 주문자(방장)는 자동으로 첫 번째 슬롯에 배정되어야 한다.
- **FR-007**: 동일 주문으로 중복 요청 시 기존 대기실을 반환하고 새로 생성하지 않아야 한다.
- **FR-008**: 대기실 생성 성공 시 결제 승인 응답에 대기실 정보를 포함해야 한다.
- **FR-009**: 초대 코드로 대기실 조회 API(`GET /api/capsules/step-rooms?invite_code={code}`)를 제공해야 한다.
- **FR-010**: deadline이 지난 대기실에는 새로운 콘텐츠 작성이 불가능해야 한다.
- **FR-011**: 주문의 미디어 제약(`photo_count`, `add_music`, `add_video`)이 모든 슬롯에 적용되어야 한다.
- **FR-012**: 상품이 비활성(`is_active=false`)이거나 타임캡슐 타입이 아닌 경우 대기실 생성을 거부해야 한다.
- **FR-013**: 대기실 생성 실패 시 오류 로그를 남기고 적절한 HTTP 상태 코드를 반환해야 한다.

### Key Entities

- **Capsule (타임캡슐 + 대기실)** - 기존 엔티티 확장
  - **기존 필드 (재활용)**:
    - `id` (UUID): 캡슐/대기실 고유 ID
    - `order_id` (UUID, unique, nullable): 연결된 주문 ID
    - `title` (string): 캡슐 이름
    - `open_at` (timestamp): 열람 날짜
    - `view_limit` (int): 인원수 제한
    - `created_at` (timestamp): 생성 시각
  - **추가 필드 (대기실 전용)**:
    - `invite_code` (string, unique, 6자, nullable): 초대 코드
    - `deadline` (timestamp, nullable): 작성 마감 시각 (created_at + 24시간)
    - `room_status` (enum, nullable): 대기실 상태 (WAITING, COMPLETED, EXPIRED)

- **CapsuleParticipantSlot (참여 슬롯)** - 기존 엔티티 활용
  - `id` (UUID): 슬롯 고유 ID
  - `capsule_id` (UUID): 캡슐 ID
  - `user_id` (UUID, nullable): 배정된 사용자 (null이면 초대 대기)
  - `slot_index` (int): 슬롯 인덱스 (0부터 시작)
  - `assigned_at` (timestamp, nullable): 슬롯 배정 시각

### Data Model Changes

- `capsules` 테이블에 3개 컬럼 추가:
  - `invite_code` (varchar(6), unique, nullable) - 초대 코드
  - `deadline` (timestamp, nullable) - 마감시한
  - `room_status` (enum: WAITING, COMPLETED, EXPIRED, nullable) - 대기실 상태
  
- **기존 필드 재활용**:
  - `order_id` - 주문 연계 (이미 unique)
  - `title` - 캡슐 이름 (대기실 이름으로 사용)
  - `open_at` - 열람 날짜
  - `view_limit` - 인원수 제한
  - `participantSlots` 관계 - 참여 슬롯 (이미 구현됨)

- **Nullable 필드 사용 이유**:
  - 대기실 없이 생성되는 일반 캡슐과 구분
  - 대기실 필드가 null이면 일반 캡슐
  - 대기실 필드가 있으면 결제 완료 후 작성 대기 중인 캡슐

## API 명세 초안

### 1. 결제 승인 API 응답 확장

**Endpoint**: `POST /api/payments/approve`  
**Request**: (기존 결제 승인 요청)  
**Response**:

```json
{
  "success": true,
  "data": {
    "order_id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "PAID",
    "step_room": {
      "room_id": "660e8400-e29b-41d4-a716-446655440001",
      "invite_code": "ABC123",
      "capsule_name": "강동구 물주먹들👊",
      "open_date": "2026-01-16",
      "deadline": "2025-12-31T13:00:00Z",
      "participant_count": 3,
      "current_participants": 1,
      "created_at": "2025-12-30T13:00:00Z"
    }
  }
}
```

### 2. 초대 코드로 대기실 조회

**Endpoint**: `GET /api/capsules/step-rooms?invite_code={code}`  
**Auth**: Optional (비회원도 조회 가능)  
**Response**:

```json
{
  "success": true,
  "data": {
    "room_id": "660e8400-e29b-41d4-a716-446655440001",
    "capsule_name": "강동구 물주먹들👊",
    "open_date": "2026-01-16",
    "deadline": "2025-12-31T13:00:00Z",
    "participant_count": 3,
    "current_participants": 2,
    "status": "ACTIVE",
    "is_joinable": true
  }
}
```

**Error Cases**:
- 404: 초대 코드가 존재하지 않음
- 200 (is_joinable=false): 마감시한 경과, 인원 마감 등

### 3. 대기실 상세 조회 (참여자용)

**Endpoint**: `GET /api/capsules/step-rooms/:roomId`  
**Auth**: JWT Required  
**Response**:

```json
{
  "success": true,
  "data": {
    "room_id": "660e8400-e29b-41d4-a716-446655440001",
    "capsule_name": "강동구 물주먹들👊",
    "open_date": "2026-01-16",
    "deadline": "2025-12-31T13:00:00Z",
    "status": "ACTIVE",
    "slots": [
      {
        "slot_number": 1,
        "user_id": "user-uuid-1",
        "is_host": true,
        "status": "SUBMITTED",
        "nickname": "방장"
      },
      {
        "slot_number": 2,
        "user_id": "user-uuid-2",
        "is_host": false,
        "status": "ACCEPTED",
        "nickname": "친구1"
      },
      {
        "slot_number": 3,
        "user_id": null,
        "is_host": false,
        "status": "PENDING",
        "nickname": null
      }
    ]
  }
}
```

## Success Criteria

### Measurable Outcomes

- **SC-001**: 결제 완료 후 3초 이내에 대기실이 생성되고 응답에 포함된다.
- **SC-002**: 생성된 초대 코드는 시스템 전체에서 고유하며 충돌이 발생하지 않는다.
- **SC-003**: deadline은 결제 완료 시각 기준 정확히 24시간 후로 설정된다 (오차 ±1초 이내).
- **SC-004**: 주문의 headcount와 생성된 슬롯 수가 일치한다.
- **SC-005**: 동일 주문으로 10번 결제 승인을 호출해도 대기실은 1개만 존재한다.
- **SC-006**: 초대 코드 조회 API 응답 시간이 평균 100ms 이하이다.
- **SC-007**: deadline이 지난 대기실에 콘텐츠 작성 시도 시 100% 거부된다.
- **SC-008**: 비활성 상품 또는 비타임캡슐 상품에 대해 대기실 생성이 거부되고 적절한 에러 코드(422)가 반환된다.

## 구현 참고사항

### 초대 코드 생성 알고리즘
- 6자리 영숫자 (A-Z, 0-9, 대문자만 사용)
- 혼동 가능한 문자 제외 (O/0, I/1/L 등)
- 재시도 로직: 충돌 시 최대 5번 재생성
- 예시: `ABC123`, `XYZ789`

### Deadline 계산
```typescript
const deadline = new Date(payment.approvedAt);
deadline.setHours(deadline.getHours() + 24);
```

### 트랜잭션 처리
- 대기실 생성, 슬롯 생성, 주문 업데이트를 하나의 트랜잭션으로 처리
- 실패 시 전체 롤백

### 인덱스 최적화
- `invite_code` 컬럼에 unique index 생성
- `order_id` 컬럼에 unique index 생성 (중복 생성 방지)
- `deadline` 컬럼에 index 생성 (만료된 대기실 조회용)

