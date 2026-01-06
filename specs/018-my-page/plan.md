# Implementation Plan: My Page (마이페이지)

**Branch**: `[018-my-page]` | **Date**: 2026-01-06 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/018-my-page/spec.md`

## Summary

마이페이지 API를 구현하여 사용자가 프로필을 관리하고, 친구를 추가/삭제하며, 참여중인 타임캡슐을 조회하고, 알림을 관리할 수 있도록 한다. NestJS + TypeORM 기반으로 RESTful API를 구축하고, 기존 User, Friendship 엔티티를 활용하며 새로운 Notification 엔티티를 추가한다.

## Technical Context

**Language/Version**: TypeScript 5.x + Node.js (NestJS 10.x)  
**Primary Dependencies**: NestJS, TypeORM, class-validator, @aws-sdk/client-s3 (S3 presigned URL)  
**Storage**: PostgreSQL (기존 DB, notifications 테이블 추가)  
**Testing**: Jest (unit/integration tests) + Playwright (E2E tests)  
**Target Platform**: Linux server (Docker 컨테이너)  
**Project Type**: Web API (단일 백엔드 프로젝트)  
**Performance Goals**: API 응답 시간 p95 < 500ms, 프로필 조회 < 200ms  
**Constraints**: JWT 기반 인증 필수, 프로필 이미지 5MB 제한, 알림 페이지네이션 기본 20개  
**Scale/Scope**: 사용자 10만명 목표, 알림 테이블 100만 rows 예상

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- ✅ 기존 User, Friendship 엔티티 재사용 (새 테이블 최소화)
- ✅ RESTful API 설계 원칙 준수
- ✅ JWT 인증 기반 보안 적용
- ⚠️ Notification 엔티티 신규 추가 필요 (알림 기능 구현 위함)
- ✅ 기존 Media 모듈 재사용 (프로필 이미지 업로드)
- ✅ TypeORM Repository 패턴 활용

## Project Structure

### Documentation (this feature)

```text
specs/018-my-page/
├── spec.md              # 기능 명세
├── plan.md              # 이 파일
├── tasks.md             # 구현 태스크 리스트 (/speckit.tasks 명령으로 생성 예정)
└── data-model.md        # 데이터 모델 상세 (선택 사항)
```

### Source Code (repository root)

```text
src/
├── auth/                         # 기존 인증 모듈 (JWT Guard 재사용)
├── entities/                     # 엔티티 정의
│   ├── user.entity.ts            # [기존] 사용자 엔티티
│   ├── friendship.entity.ts      # [기존] 친구 관계 엔티티
│   ├── capsule.entity.ts         # [기존] 캡슐 엔티티
│   ├── capsule-participant-slot.entity.ts # [기존] 캡슐 참여 슬롯
│   └── notification.entity.ts    # [신규] 알림 엔티티
├── me/                           # [신규] 마이페이지 모듈
│   ├── me.module.ts              # 모듈 정의
│   ├── me.controller.ts          # 마이페이지 API 컨트롤러
│   ├── me.service.ts             # 비즈니스 로직
│   ├── friends.controller.ts     # 친구 관리 API
│   ├── friends.service.ts        # 친구 관리 로직
│   ├── notifications.controller.ts # 알림 API
│   ├── notifications.service.ts  # 알림 로직
│   └── dto/                      # DTO 정의
│       ├── update-profile.dto.ts
│       ├── add-friend.dto.ts
│       ├── update-settings.dto.ts
│       ├── send-notification.dto.ts
│       ├── profile-response.dto.ts
│       ├── capsule-list-response.dto.ts
│       ├── friend-list-response.dto.ts
│       └── notification-response.dto.ts
├── media/                        # [기존] 미디어 업로드 모듈 재사용
└── migrations/                   # 마이그레이션 파일
    └── XXXXXXXX-create-notifications-table.ts

tests/
└── playwright/
    └── me.spec.ts                # [신규] E2E 테스트
```

**Structure Decision**: 단일 백엔드 프로젝트 구조를 사용하며, `src/me/` 모듈을 신규 생성하여 마이페이지 관련 기능을 모듈화한다. 기존 엔티티(User, Friendship, Capsule 등)를 재사용하고, Notification 엔티티만 신규 추가한다. Media 모듈은 프로필 이미지 업로드를 위해 재사용한다.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Notification 엔티티 추가 | 알림 기능 구현 위해 알림 데이터를 저장할 테이블 필요 | 기존 엔티티로는 알림 이력, 읽음 상태, 알림 타입 관리 불가능 |
| 3개의 컨트롤러 분리 (me, friends, notifications) | 관심사 분리 및 API 명확성 향상 | 단일 컨트롤러로 모든 기능을 처리하면 코드가 길어지고 유지보수 어려움 |

## Phase 0: Research (기술 조사)

### 기존 코드베이스 확인 사항

1. **User 엔티티 분석**:
   - `nickname`, `email`, `phoneNumber`, `profileImg`, `isPushAgreed`, `isMarketingAgreed` 필드 존재 확인 완료 ✅
   - 프로필 수정 시 unique 제약조건 확인 필요 (nickname 중복 체크)

2. **Friendship 엔티티 분석**:
   - `user_id < friend_id` 제약조건 존재 ✅
   - `status` 필드가 `PENDING`, `ACCEPTED`, `BLOCKED` enum으로 정의됨 ✅
   - 친구 추가/삭제 로직 구현 필요

3. **Capsule & CapsuleParticipantSlot 분석**:
   - 사용자가 참여중인 캡슐을 조회하려면 `capsules.userId`(소유자)와 `capsule_participant_slots.userId`(참여자)를 모두 조회해야 함
   - 캡슐 상태는 `status` 필드로 관리 (PENDING, PUBLISHED, OPENED 등)

4. **Media 모듈 재사용**:
   - `POST /api/media/presigned-url` 엔드포인트 활용 가능
   - 프로필 이미지 업로드는 별도 엔드포인트로 제공할지, Media 모듈 직접 사용할지 결정 필요
   - 결정: `POST /api/me/profile-image` 엔드포인트를 만들어 Media 서비스를 내부적으로 호출

5. **JWT 인증**:
   - `@UseGuards(JwtAuthGuard)` 적용 ✅
   - `@CurrentUser()` 데코레이터로 현재 사용자 정보 추출 ✅

### 신규 구현 필요 사항

1. **Notification 엔티티 설계**:
   - 필드: `id`, `userId`, `title`, `content`, `type`, `isRead`, `createdAt`
   - 인덱스: `userId`, `createdAt`, `isRead` (조회 성능 최적화)
   - 관계: User (ManyToOne)

2. **알림 타입 Enum 정의**:
   - `CAPSULE_OPEN`, `FRIEND_REQUEST`, `FRIEND_ACCEPTED`, `SYSTEM`, `MARKETING`

3. **페이지네이션 공통 DTO**:
   - `limit`, `offset` 파라미터 정의
   - 기본값: limit=20, offset=0

## Phase 1: Design (설계)

### API 엔드포인트 설계

#### 프로필 관리

- `GET /api/me` - 내 프로필 조회
  - Response: `{ id, nickname, email, phoneNumber, profileImg, isPushAgreed, isMarketingAgreed, eggSlots, createdAt }`
  
- `PATCH /api/me` - 프로필 수정
  - Body: `{ nickname?, email? }`
  - Response: `{ message: 'Profile updated', profile: {...} }`
  
- `POST /api/me/profile-image` - 프로필 이미지 업로드 URL 요청
  - Body: `{ contentType: string, fileSize: number }`
  - Response: `{ uploadUrl: string, key: string }`
  - 업로드 완료 후 자동으로 User.profileImg 업데이트

- `PATCH /api/me/settings` - 알림 설정 수정
  - Body: `{ isPushAgreed?: boolean, isMarketingAgreed?: boolean }`
  - Response: `{ message: 'Settings updated' }`

#### 타임캡슐 참여 내역

- `GET /api/me/capsules?limit=20&offset=0` - 참여중인 캡슐 리스트
  - Response: `{ items: [{ id, title, status, openDate, participantCount, myWriteStatus }], total, limit, offset }`

#### 친구 관리

- `GET /api/me/friends?limit=20&offset=0` - 친구 목록
  - Response: `{ items: [{ id, user: {...}, friend: {...}, status }], total, limit, offset }`
  
- `POST /api/me/friends` - 친구 추가
  - Body: `{ phoneNumber: string }`
  - Response: `{ message: 'Friend added', friendship: {...} }` (201)
  
- `DELETE /api/me/friends/:friendshipId` - 친구 삭제
  - Response: `204 No Content`

#### 알림 관리

- `GET /api/me/notifications?limit=20&offset=0` - 알림 리스트
  - Response: `{ items: [{ id, title, content, type, isRead, createdAt }], total, limit, offset }`
  
- `GET /api/me/notifications/unread-count` - 읽지 않은 알림 개수
  - Response: `{ count: number }`
  
- `PATCH /api/me/notifications/:notificationId/read` - 알림 읽음 처리
  - Response: `{ message: 'Notification marked as read' }`

#### 관리자 기능

- `POST /api/admin/notifications` - 알림 발송 (관리자 전용)
  - Body: `{ targetType: 'USER' | 'ALL', userId?: string, title: string, content: string, type: string }`
  - Response: `{ message: 'Notifications sent', count: number }` (201)

### 데이터 모델

#### Notification Entity (신규)

```typescript
@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 100 })
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column({
    type: 'enum',
    enum: NotificationType,
    comment: 'CAPSULE_OPEN, FRIEND_REQUEST, FRIEND_ACCEPTED, SYSTEM, MARKETING',
  })
  type: NotificationType;

  @Column({ type: 'boolean', default: false, name: 'is_read' })
  isRead: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => User, (user) => user.notifications, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
```

#### NotificationType Enum (신규)

```typescript
export enum NotificationType {
  CAPSULE_OPEN = 'CAPSULE_OPEN',
  FRIEND_REQUEST = 'FRIEND_REQUEST',
  FRIEND_ACCEPTED = 'FRIEND_ACCEPTED',
  SYSTEM = 'SYSTEM',
  MARKETING = 'MARKETING',
}
```

### 비즈니스 로직 설계

#### MeService

- `getMyProfile(userId: string)`: User 조회
- `updateProfile(userId: string, dto: UpdateProfileDto)`: 닉네임/이메일 수정, 중복 체크
- `updateSettings(userId: string, dto: UpdateSettingsDto)`: 알림 설정 수정
- `getMyCapsules(userId: string, limit, offset)`: 소유 캡슐 + 참여 캡슐 조회
  - `capsules.userId = userId` OR `capsule_participant_slots.userId = userId`
  - LEFT JOIN으로 참여자 수 계산
  - 페이지네이션 적용

#### FriendsService

- `getFriends(userId: string, limit, offset)`: 친구 목록 조회
  - `friendships.userId = userId` OR `friendships.friendId = userId`
  - 양방향 조회 후 상대방 정보 매핑
- `addFriend(userId: string, phoneNumber: string)`: 친구 추가
  - 전화번호로 대상 사용자 조회
  - 자기 자신 체크
  - 중복 관계 체크
  - `user_id < friend_id` 정렬 후 저장
  - status는 `ACCEPTED`로 설정 (자동 승인)
- `removeFriend(userId: string, friendshipId: string)`: 친구 삭제
  - Friendship 조회 후 userId가 포함되어 있는지 확인
  - 권한 없으면 403

#### NotificationsService

- `getNotifications(userId: string, limit, offset)`: 알림 목록 조회
  - `notifications.userId = userId` ORDER BY createdAt DESC
- `getUnreadCount(userId: string)`: 읽지 않은 개수
  - `COUNT(*) WHERE userId = userId AND isRead = false`
- `markAsRead(userId: string, notificationId: string)`: 읽음 처리
  - Notification 조회 후 userId 일치 확인
  - isRead = true로 업데이트
- `sendNotification(targetType, userId?, title, content, type)`: 알림 발송 (관리자)
  - targetType이 'USER'면 단일 사용자에게 발송
  - targetType이 'ALL'이면 모든 활성 사용자에게 발송
  - Bulk insert 사용 (성능 최적화)

### 에러 처리

- `400 Bad Request`: 잘못된 요청 데이터 (닉네임 중복, 유효하지 않은 파라미터 등)
- `403 Forbidden`: 권한 없음 (다른 사용자의 알림 접근, 관리자 권한 필요 등)
- `404 Not Found`: 리소스 없음 (존재하지 않는 사용자, friendship, notification)
- `409 Conflict`: 중복 리소스 (이미 친구 관계 존재)

### 보안 고려사항

- 모든 엔드포인트에 `@UseGuards(JwtAuthGuard)` 적용
- 관리자 엔드포인트는 추가로 `AdminGuard` 적용 (향후 구현)
- 친구 관계 조회/삭제 시 본인 관련 데이터만 접근 가능하도록 검증
- 알림 조회/수정 시 본인 알림만 접근 가능하도록 검증
- 프로필 이미지 업로드 시 파일 타입/크기 검증

### 성능 최적화

- Notification 테이블에 인덱스 추가: `(user_id, created_at)`, `(user_id, is_read)`
- 참여중인 캡슐 조회 시 N+1 문제 방지: `leftJoinAndSelect` 사용
- 친구 목록 조회 시 User 정보 JOIN으로 한 번에 조회
- 알림 개수 조회는 COUNT 쿼리만 실행 (데이터 로드 최소화)
- 페이지네이션 기본값 20개로 제한

## Dependencies & Integration Points

### 기존 모듈 재사용

- **AuthModule**: JWT 인증 가드, CurrentUser 데코레이터
- **MediaModule**: S3 presigned URL 생성, 프로필 이미지 업로드
- **DatabaseModule**: TypeORM 설정, 트랜잭션 관리

### 신규 모듈

- **MeModule**: 마이페이지 기능 모듈
  - Imports: AuthModule, MediaModule, TypeOrmModule.forFeature([User, Friendship, Notification, Capsule, CapsuleParticipantSlot])
  - Controllers: MeController, FriendsController, NotificationsController
  - Services: MeService, FriendsService, NotificationsService

### 외부 의존성

- AWS SDK (S3): 프로필 이미지 업로드
- PostgreSQL: 데이터 저장소
- JWT: 인증 토큰

## Testing Strategy

### Unit Tests

- MeService 테스트: 프로필 조회/수정 로직
- FriendsService 테스트: 친구 추가/삭제 로직, 중복/권한 체크
- NotificationsService 테스트: 알림 조회/읽음 처리/발송 로직

### Integration Tests

- MeController 테스트: API 엔드포인트 동작 확인
- JWT 인증 통합 테스트
- 데이터베이스 통합 테스트 (실제 DB 사용)

### E2E Tests (Playwright)

- 프로필 조회 및 수정 시나리오
- 친구 추가 → 목록 조회 → 삭제 시나리오
- 알림 발송 → 조회 → 읽음 처리 시나리오
- 참여중인 캡슐 리스트 조회 시나리오

## Migration Plan

### 1. Notification 테이블 생성

```sql
CREATE TYPE notification_type_enum AS ENUM ('CAPSULE_OPEN', 'FRIEND_REQUEST', 'FRIEND_ACCEPTED', 'SYSTEM', 'MARKETING');

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  type notification_type_enum NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_user_id_created_at ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_user_id_is_read ON notifications(user_id, is_read);
```

### 2. User 엔티티 업데이트

- `notifications` OneToMany 관계 추가

```typescript
@OneToMany(() => Notification, (notification) => notification.user)
notifications: Notification[];
```

## Deployment Considerations

- 마이그레이션 실행 후 배포
- 기존 사용자 데이터는 영향 없음 (신규 테이블 추가만)
- API 버전 관리 필요 없음 (신규 엔드포인트 추가)
- 알림 발송 기능은 관리자 권한 구현 후 활성화

## Future Enhancements

- 친구 요청 승인/거부 흐름 추가 (현재는 자동 승인)
- 실시간 푸시 알림 연동 (FCM, APNs)
- 알림 카테고리별 필터링
- 프로필 이미지 썸네일 생성
- 친구 추천 기능 (전화번호 기반)
- 알림 일괄 삭제 기능

