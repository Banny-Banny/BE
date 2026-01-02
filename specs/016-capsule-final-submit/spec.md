# Feature Specification: 타임캡슐 최종 제출 API

**Feature Branch**: `016-capsule-final-submit`  
**Created**: 2025-01-02  
**Status**: Draft  
**Input**: 프론트엔드에서 타임캡슐 최종 제출 API 요청

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 방장이 모든 참여자 완료 후 수동 제출 (Priority: P1)

방장이 모든 참여자의 콘텐츠 작성이 완료된 후, 현재 위치에서 타임캡슐을 최종 제출하여 매장합니다.

**Why this priority**: 핵심 사용자 플로우. 타임캡슐 서비스의 완성 단계로, 이 기능이 없으면 캡슐이 매장되지 않습니다.

**Independent Test**: 방장 계정으로 로그인 → 모든 참여자 저장 완료 확인 → 현재 위치에서 제출 → 캡슐 상태 `BURIED`로 변경 확인 → 지도에서 매장된 위치 확인 가능

**Acceptance Scenarios**:

1. **Given** 방장이 로그인하고 4명의 참여자가 모두 콘텐츠 저장을 완료한 상태, **When** 방장이 현재 위치(lat: 37.5665, lng: 126.9780)에서 `POST /api/step-rooms/{roomId}/submit` 호출, **Then** 캡슐 상태가 `BURIED`로 변경되고, 위치가 저장되며, `is_auto_submitted: false`로 설정됨
2. **Given** 캡슐이 성공적으로 제출된 상태, **When** 프론트엔드에서 응답 확인, **Then** `capsule_id`, `status: "BURIED"`, `location`, `buried_at`, `open_date`, `participants: 4` 정보가 반환됨
3. **Given** 제출 완료된 캡슐, **When** 다른 참여자가 지도에서 조회, **Then** `open_date` 이전에는 잠긴 상태(`is_locked: true`)로 표시되고, `open_date` 이후 열람 가능

---

### User Story 2 - 권한 검증: 방장이 아닌 사용자 제출 시도 (Priority: P1)

방장이 아닌 참여자가 제출을 시도하면 권한 에러가 반환됩니다.

**Why this priority**: 보안 및 권한 제어는 필수입니다. 방장만 제출할 수 있어야 합니다.

**Independent Test**: 일반 참여자 계정으로 로그인 → 제출 API 호출 → `NOT_ROOM_OWNER` 에러 반환 확인

**Acceptance Scenarios**:

1. **Given** 참여자(slot_index != 0)가 로그인한 상태, **When** `POST /api/step-rooms/{roomId}/submit` 호출, **Then** 403 에러와 `NOT_ROOM_OWNER` 에러 코드 반환
2. **Given** 캡슐에 참여하지 않은 사용자, **When** 제출 API 호출, **Then** 403 에러와 `UNAUTHORIZED_ACCESS` 반환

---

### User Story 3 - 참여자 미완료 시 제출 차단 (Priority: P1)

모든 참여자가 콘텐츠 저장을 완료하지 않은 상태에서 방장이 제출을 시도하면, 미완료 참여자 목록과 함께 에러가 반환됩니다.

**Why this priority**: 데이터 무결성 보장. 모든 참여자의 콘텐츠가 포함되어야 완전한 타임캡슐입니다.

**Independent Test**: 방장 로그인 → 2명만 저장 완료 상태 → 제출 시도 → `INCOMPLETE_PARTICIPANTS` 에러 및 미완료 사용자 목록 반환 확인

**Acceptance Scenarios**:

1. **Given** 총 4명 중 2명만 콘텐츠 저장 완료(`status: "COMPLETED"`), **When** 방장이 제출 API 호출, **Then** `INCOMPLETE_PARTICIPANTS` 에러 반환 및 `completed: 2, total: 4, incomplete_users: ["박초롱", "김철수"]` 정보 제공
2. **Given** 미완료 상태에서 에러 받음, **When** 나머지 참여자들이 저장 완료, **Then** 방장이 다시 제출 시 성공

---

### User Story 4 - 24시간 자동 제출 (크론잡) (Priority: P2)

결제 완료 후 24시간이 경과했지만 방장이 수동 제출하지 않은 캡슐은 자동으로 방장의 마지막 저장 위치에 매장됩니다.

**Why this priority**: 사용자 경험 개선. 방장이 제출을 잊어도 캡슐이 소실되지 않도록 보호합니다.

**Independent Test**: 크론잡 실행 → `deadline` 경과 + `status: "IN_PROGRESS"` 캡슐 조회 → 자동 매장 → `is_auto_submitted: true` 확인 → 참여자에게 알림 전송 확인

**Acceptance Scenarios**:

1. **Given** 결제 완료 후 24시간 경과(`deadline` < 현재 시각), `roomStatus: "WAITING"` 또는 `"COMPLETED"` 상태, **When** 크론잡 실행, **Then** 방장의 마지막 위치(또는 기본 위치)로 자동 매장, `roomStatus: "BURIED"`, `is_auto_submitted: true` 설정
2. **Given** 자동 제출 완료, **When** 참여자 조회, **Then** 모든 참여자에게 푸시/이메일 알림 발송: "타임캡슐이 자동으로 매장되었습니다. {open_date}에 개봉됩니다!"
3. **Given** 방장이 24시간 내 수동 제출한 캡슐, **When** 크론잡 실행, **Then** 해당 캡슐은 스킵됨 (이미 `BURIED` 상태)

---

### Edge Cases

- **24시간 경과 전 수동 제출**: 방장이 deadline 전에 수동 제출하면 자동 제출 대상에서 제외됨
- **방장의 위치 정보 없음**: 방장이 한 번도 위치 정보를 저장하지 않은 경우 → 기본 위치(서울시청 등) 또는 마지막 주문 위치 사용
- **중복 제출 방지**: 이미 `BURIED` 상태인 캡슐에 제출 API 재호출 시 → `ALREADY_SUBMITTED` 에러 반환
- **deadline 정확히 동시**: deadline과 제출 시각이 정확히 겹치는 경우 → 수동 제출 우선 (낙관적 락 또는 트랜잭션 처리)
- **참여자 0명**: `headcount: 1`이고 방장만 있는 경우 → 방장 저장 완료 시 바로 제출 가능
- **캡슐 삭제 후 제출 시도**: 이미 삭제된(`deletedAt != NULL`) 캡슐에 제출 시도 → `CAPSULE_NOT_FOUND` 에러

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 시스템은 방장(`slot_index = 0` 또는 `userId = capsule.userId`)만 타임캡슐을 최종 제출할 수 있어야 함
- **FR-002**: 시스템은 모든 참여자(`CapsuleParticipantSlot`)의 `status`가 `"COMPLETED"`일 때만 제출을 허용해야 함
- **FR-003**: 시스템은 제출 시 방장의 현재 위도(`latitude`)와 경도(`longitude`)를 캡슐에 저장해야 함
- **FR-004**: 시스템은 제출 성공 시 캡슐의 `roomStatus`를 `"BURIED"`로 변경해야 함
- **FR-005**: 시스템은 제출 시각(`buried_at`)을 기록해야 함
- **FR-006**: 시스템은 결제 완료 후 24시간 경과 시 자동으로 캡슐을 매장하는 크론잡을 제공해야 함
- **FR-007**: 자동 제출 시 `is_auto_submitted` 필드를 `true`로 설정해야 함
- **FR-008**: 자동 제출 후 모든 참여자에게 푸시/이메일 알림을 발송해야 함
- **FR-009**: 시스템은 이미 제출된 캡슐에 대한 중복 제출을 차단해야 함 (`ALREADY_SUBMITTED` 에러)
- **FR-010**: 제출된 캡슐은 `open_date` 이전까지 `is_locked: true` 상태를 유지해야 함

### Non-Functional Requirements

- **NFR-001**: API 응답 시간 < 2초 (위치 저장 및 상태 업데이트)
- **NFR-002**: 크론잡은 매 시간 또는 매 10분마다 실행되어 deadline 경과 캡슐을 처리해야 함
- **NFR-003**: 트랜잭션 처리로 동시성 문제 방지 (방장이 제출하는 순간 크론잡이 실행되는 경우)
- **NFR-004**: 알림 발송 실패 시에도 캡슐 매장은 정상 완료되어야 함 (알림은 비동기 처리)

### Key Entities

- **Capsule**: 타임캡슐 엔티티
  - 제출 시 업데이트: `latitude`, `longitude`, `roomStatus: "BURIED"`, `buriedAt`(새 필드)
  - 자동 제출 플래그: `isAutoSubmitted`(새 필드)
- **CapsuleParticipantSlot**: 참여자 슬롯 엔티티
  - 제출 전 검증: 모든 슬롯의 `status = "COMPLETED"` 확인
  - 방장 확인: `slotIndex = 0` 또는 `userId = capsule.userId`
- **Order**: 주문 엔티티
  - `deadline` 계산 기준: 결제 완료 시각(`paidAt`) + 24시간

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 방장이 제출 API 호출 시 2초 이내 캡슐 매장 완료 및 응답 반환
- **SC-002**: 24시간 경과 캡슐 100% 자동 매장 (크론잡 안정성)
- **SC-003**: 권한이 없는 사용자의 제출 시도 100% 차단
- **SC-004**: 참여자 미완료 시 제출 차단율 100%
- **SC-005**: 자동 제출 시 알림 발송 성공률 > 95%
- **SC-006**: 중복 제출 차단율 100%

## API Specification

### Endpoint

```
POST /api/step-rooms/{roomId}/submit
```

### Request Headers

```
Authorization: Bearer <JWT_TOKEN>
```

### Request Body

```json
{
  "latitude": 37.5665,
  "longitude": 126.9780
}
```

### Response - 성공 (200 OK)

```json
{
  "success": true,
  "data": {
    "capsule_id": "uuid",
    "status": "BURIED",
    "location": {
      "latitude": 37.5665,
      "longitude": 126.9780,
      "address": "서울특별시 중구 세종대로 110"
    },
    "buried_at": "2025-12-30T13:00:00Z",
    "open_date": "2026-01-16T00:00:00Z",
    "participants": 4,
    "is_auto_submitted": false
  }
}
```

### Response - 실패 (403 Forbidden - 권한 없음)

```json
{
  "success": false,
  "error": "NOT_ROOM_OWNER",
  "message": "방장만 최종 제출할 수 있습니다"
}
```

### Response - 실패 (400 Bad Request - 참여자 미완료)

```json
{
  "success": false,
  "error": "INCOMPLETE_PARTICIPANTS",
  "message": "모든 참여자가 저장을 완료해야 제출할 수 있습니다",
  "data": {
    "completed": 2,
    "total": 4,
    "incomplete_users": ["박초롱", "김철수"]
  }
}
```

### Response - 실패 (409 Conflict - 이미 제출됨)

```json
{
  "success": false,
  "error": "ALREADY_SUBMITTED",
  "message": "이미 제출된 캡슐입니다"
}
```

### Response - 실패 (404 Not Found - 캡슐 없음)

```json
{
  "success": false,
  "error": "CAPSULE_NOT_FOUND",
  "message": "캡슐을 찾을 수 없습니다"
}
```

## 자동 제출 (백엔드 크론잡)

### 조건

- 결제 완료 후 24시간 경과 (`deadline < NOW()`)
- 아직 수동 제출 안됨 (`roomStatus != "BURIED"`)

### 실행

1. 방장의 마지막 저장된 위치로 자동 매장 (방장이 슬롯 콘텐츠 저장 시 위치 기록)
2. `roomStatus` → `"BURIED"`
3. `isAutoSubmitted` → `true`
4. 참여자 전원에게 푸시/이메일 알림 발송

### 알림 내용 예시

```json
{
  "type": "AUTO_SUBMIT",
  "title": "타임캡슐이 자동으로 매장되었습니다",
  "message": "강동구 물주먹들👊 캡슐이 서울특별시 강동구에 매장되었습니다. 2026년 1월 16일에 개봉됩니다!",
  "capsule_id": "uuid",
  "open_date": "2026-01-16"
}
```

## Database Changes

### 새로운 필드 추가 (Capsule 엔티티)

```typescript
@Column({
  type: 'timestamp',
  nullable: true,
  name: 'buried_at',
  comment: '캡슐이 매장된 시각',
})
buriedAt: Date | null;

@Column({
  type: 'boolean',
  default: false,
  name: 'is_auto_submitted',
  comment: '자동 제출 여부',
})
isAutoSubmitted: boolean;
```

### Migration 파일 생성

```bash
npm run typeorm:generate AddCapsuleBuriedFields
```

## 재사용 가능한 기존 코드

1. **`ensurePaidCapsuleContext(capsuleId)`** (capsules.service.ts, line 814-838)
   - 결제 완료된 캡슐 검증 로직 재사용
   - 캡슐, 주문, 상품 정보 조회

2. **`slotRepository.find()`** (capsules.service.ts, 여러 곳)
   - 참여자 슬롯 조회 및 완료 상태 확인

3. **`JwtAuthGuard`** (auth/guards/jwt-auth.guard.ts)
   - JWT 인증 가드 재사용

4. **`CurrentUser` 데코레이터** (auth/decorators/current-user.decorator.ts)
   - 현재 로그인 사용자 정보 주입

5. **`RoomStatus` enum** (common/enums/index.ts, line 58-62)
   - 기존 대기실 상태 enum 활용

6. **트랜잭션 패턴** (capsules.service.ts, 여러 메서드)
   - `this.dataSource.transaction()` 패턴 재사용하여 동시성 제어

## Implementation Notes

- 컨트롤러: `CapsulesController`에 `POST /step-rooms/:capsuleId/submit` 엔드포인트 추가
- 서비스: `CapsulesService`에 `submitCapsule(capsuleId, userId, latitude, longitude)` 메서드 추가
- DTO: `SubmitCapsuleDto` (request body), `SubmitCapsuleResponseDto` (response) 생성
- 크론잡: NestJS `@nestjs/schedule` 패키지 사용하여 `CapsuleCronService` 생성
- 알림: 별도 `NotificationService` 또는 이벤트 발행 (현재 미구현이므로 TODO 주석 처리)

## Testing Strategy

1. **Unit Tests**:
   - 방장 권한 검증 로직
   - 참여자 완료 상태 검증 로직
   - 중복 제출 차단 로직

2. **Integration Tests**:
   - 제출 API 호출 (성공 케이스)
   - 권한 에러 케이스
   - 참여자 미완료 에러 케이스
   - 이미 제출된 캡슐 에러 케이스

3. **E2E Tests** (Playwright):
   - 전체 플로우: 결제 → 대기실 생성 → 참여자 저장 → 방장 제출 → 지도 조회
   - 자동 제출 플로우: 결제 → 24시간 경과 → 크론잡 실행 → 자동 매장 확인

## Dependencies

- 기존 의존성만 사용 (새 패키지 설치 불필요)
- 크론잡: `@nestjs/schedule` (이미 설치되어 있어야 함, 없으면 추가)
- 알림: 외부 알림 서비스 (현재 미구현, 추후 연동)

