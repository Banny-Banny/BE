# Data Model: My Page (마이페이지)

**Feature**: 018-my-page  
**Date**: 2026-01-06

## Overview

마이페이지 기능을 위해 기존 User, Friendship 엔티티를 활용하고, 알림 기능을 위한 Notification 엔티티를 신규 추가합니다.

## Entities

### 1. User (기존 엔티티)

**Table**: `users`  
**Purpose**: 사용자 기본 정보 및 프로필 관리

#### Columns

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | 사용자 고유 ID |
| nickname | VARCHAR(50) | NOT NULL | 앱 내 표시 이름 |
| phone_number | VARCHAR(20) | UNIQUE, NOT NULL | 친구 추가 및 중복 가입 방지 |
| email | VARCHAR(100) | NULLABLE | 계정 복구 및 알림용 |
| profile_img | VARCHAR(500) | NULLABLE | S3 이미지 URL |
| password_hash | VARCHAR(255) | NULLABLE | 로컬 로그인용 bcrypt 해시 |
| token_version | INT | DEFAULT 0 | JWT 무효화용 버전 |
| kakao_id | VARCHAR(100) | UNIQUE, NULLABLE | 카카오 소셜로그인 ID |
| provider | VARCHAR(20) | DEFAULT 'LOCAL' | 인증 제공자 (KAKAO, GOOGLE, APPLE, LOCAL) |
| is_marketing_agreed | BOOLEAN | DEFAULT FALSE | 마케팅 정보 수신 동의 |
| is_push_agreed | BOOLEAN | DEFAULT TRUE | 앱 푸시 알림 수신 동의 |
| is_location_term_agreed | BOOLEAN | DEFAULT FALSE | 위치기반 서비스 이용약관 동의 |
| is_active | BOOLEAN | DEFAULT TRUE | 활동중/탈퇴/정지 상태 |
| egg_slots | INT | DEFAULT 3 | 이스터에그 작성 가능 슬롯 |
| created_at | TIMESTAMP | NOT NULL | 가입일 |
| updated_at | TIMESTAMP | NULLABLE | 수정일 |
| deleted_at | TIMESTAMP | NULLABLE | 탈퇴일 (Soft Delete) |

#### Relationships

- **One-to-Many**: Capsule (소유 캡슐)
- **One-to-Many**: Order (주문 내역)
- **One-to-Many**: Friendship (친구 관계)
- **One-to-Many**: Notification (받은 알림) ⬅️ **신규 추가**
- **One-to-Many**: CapsuleParticipantSlot (참여 캡슐 슬롯)
- **One-to-Many**: CapsuleEntry (작성한 글)
- **One-to-Many**: Media (업로드한 미디어)

#### Indexes

```sql
CREATE INDEX idx_users_phone_number ON users(phone_number);
CREATE INDEX idx_users_kakao_id ON users(kakao_id);
CREATE INDEX idx_users_is_active ON users(is_active);
```

---

### 2. Friendship (기존 엔티티)

**Table**: `friendships`  
**Purpose**: 사용자 간 친구 관계 관리

#### Columns

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | 관계 고유 ID |
| user_id | UUID | FK → users(id), NOT NULL | 요청자 |
| friend_id | UUID | FK → users(id), NOT NULL | 대상자 |
| status | ENUM | NOT NULL, DEFAULT 'PENDING' | PENDING, ACCEPTED, BLOCKED |
| created_at | TIMESTAMP | NOT NULL | 관계 생성일 |
| updated_at | TIMESTAMP | NULLABLE | 상태 변경일 |

#### Constraints

- **UNIQUE**: (user_id, friend_id) - 중복 관계 방지
- **CHECK**: user_id < friend_id - 양방향 중복 방지 (정렬 강제)

#### Relationships

- **Many-to-One**: User (user)
- **Many-to-One**: User (friend)

#### Indexes

```sql
CREATE INDEX idx_friendships_user_id ON friendships(user_id);
CREATE INDEX idx_friendships_friend_id ON friendships(friend_id);
CREATE INDEX idx_friendships_status ON friendships(status);
```

---

### 3. Notification (신규 엔티티) ⬅️ **NEW**

**Table**: `notifications`  
**Purpose**: 사용자에게 발송되는 알림 관리

#### Columns

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | 알림 고유 ID |
| user_id | UUID | FK → users(id), NOT NULL, ON DELETE CASCADE | 알림 수신자 |
| title | VARCHAR(100) | NOT NULL | 알림 제목 |
| content | TEXT | NOT NULL | 알림 내용 |
| type | ENUM | NOT NULL | CAPSULE_OPEN, FRIEND_REQUEST, FRIEND_ACCEPTED, SYSTEM, MARKETING |
| is_read | BOOLEAN | DEFAULT FALSE | 읽음 여부 |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 알림 생성일 |

#### Notification Type Enum

```typescript
export enum NotificationType {
  CAPSULE_OPEN = 'CAPSULE_OPEN',           // 타임캡슐 오픈 알림
  FRIEND_REQUEST = 'FRIEND_REQUEST',       // 친구 요청 알림
  FRIEND_ACCEPTED = 'FRIEND_ACCEPTED',     // 친구 수락 알림
  SYSTEM = 'SYSTEM',                       // 시스템 공지
  MARKETING = 'MARKETING',                 // 마케팅 알림
}
```

#### Relationships

- **Many-to-One**: User (알림 수신자)

#### Indexes

```sql
CREATE INDEX idx_notifications_user_id_created_at ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_user_id_is_read ON notifications(user_id, is_read);
```

**Index Rationale**:
- `(user_id, created_at)`: 특정 사용자의 알림 리스트를 최신순으로 조회 시 성능 최적화
- `(user_id, is_read)`: 읽지 않은 알림 개수 조회 시 성능 최적화

---

## Entity Relationships Diagram

```
┌──────────────┐
│     User     │
└──────┬───────┘
       │
       ├─────────────┐
       │ 1         * │
       │             │
┌──────▼─────────┐   │
│  Notification  │   │
└────────────────┘   │
                     │
       ┌─────────────┘
       │ 1         *
       │
┌──────▼──────────┐
│   Friendship    │ (user_id, friend_id 양방향)
└─────────────────┘
       │
       │ *       1
       │
┌──────▼───────┐
│     User     │ (friend)
└──────────────┘
```

---

## Data Access Patterns

### 프로필 관리

#### 1. 내 프로필 조회

```typescript
// Query: SELECT * FROM users WHERE id = :userId
const user = await userRepository.findOne({ where: { id: userId } });
```

#### 2. 프로필 수정 (닉네임 중복 체크)

```typescript
// Query 1: SELECT * FROM users WHERE nickname = :nickname AND id != :userId
const existingUser = await userRepository.findOne({
  where: { nickname, id: Not(userId) }
});

// Query 2: UPDATE users SET nickname = :nickname WHERE id = :userId
await userRepository.update(userId, { nickname });
```

### 친구 관리

#### 3. 친구 목록 조회 (양방향)

```typescript
// Query: 
// SELECT f.*, u1.*, u2.* FROM friendships f
// LEFT JOIN users u1 ON f.user_id = u1.id
// LEFT JOIN users u2 ON f.friend_id = u2.id
// WHERE (f.user_id = :userId OR f.friend_id = :userId) AND f.status = 'ACCEPTED'
// ORDER BY f.created_at DESC
// LIMIT :limit OFFSET :offset

const friendships = await friendshipRepository
  .createQueryBuilder('f')
  .leftJoinAndSelect('f.user', 'user')
  .leftJoinAndSelect('f.friend', 'friend')
  .where('(f.userId = :userId OR f.friendId = :userId)', { userId })
  .andWhere('f.status = :status', { status: FriendStatus.ACCEPTED })
  .orderBy('f.createdAt', 'DESC')
  .skip(offset)
  .take(limit)
  .getManyAndCount();
```

#### 4. 친구 추가 (user_id < friend_id 정렬)

```typescript
// Query 1: SELECT * FROM users WHERE phone_number = :phoneNumber
const targetUser = await userRepository.findOne({ where: { phoneNumber } });

// Query 2: SELECT * FROM friendships 
// WHERE (user_id = :userId AND friend_id = :targetUserId) 
//    OR (user_id = :targetUserId AND friend_id = :userId)
const existingFriendship = await friendshipRepository.findOne({
  where: [
    { userId: smallerId, friendId: largerId },
  ]
});

// Query 3: INSERT INTO friendships (user_id, friend_id, status) 
// VALUES (:smallerId, :largerId, 'ACCEPTED')
const friendship = friendshipRepository.create({
  userId: smallerId,
  friendId: largerId,
  status: FriendStatus.ACCEPTED
});
await friendshipRepository.save(friendship);
```

### 타임캡슐 참여 내역

#### 5. 참여중인 캡슐 리스트 조회

```typescript
// Query:
// (SELECT c.* FROM capsules c WHERE c.user_id = :userId)
// UNION
// (SELECT c.* FROM capsules c
//  INNER JOIN capsule_participant_slots cps ON c.id = cps.capsule_id
//  WHERE cps.user_id = :userId)
// ORDER BY created_at DESC
// LIMIT :limit OFFSET :offset

// TypeORM 구현:
const ownedCapsules = capsuleRepository
  .createQueryBuilder('c')
  .where('c.userId = :userId', { userId })
  .getMany();

const participatedCapsuleIds = await capsuleParticipantSlotRepository
  .createQueryBuilder('cps')
  .select('cps.capsuleId')
  .where('cps.userId = :userId', { userId })
  .getRawMany();

const allCapsules = await capsuleRepository
  .createQueryBuilder('c')
  .where('c.userId = :userId', { userId })
  .orWhere('c.id IN (:...capsuleIds)', { capsuleIds: participatedCapsuleIds })
  .orderBy('c.createdAt', 'DESC')
  .skip(offset)
  .take(limit)
  .getManyAndCount();
```

### 알림 관리

#### 6. 알림 리스트 조회

```typescript
// Query: 
// SELECT * FROM notifications 
// WHERE user_id = :userId 
// ORDER BY created_at DESC 
// LIMIT :limit OFFSET :offset

const notifications = await notificationRepository.findAndCount({
  where: { userId },
  order: { createdAt: 'DESC' },
  skip: offset,
  take: limit,
});
```

#### 7. 읽지 않은 알림 개수

```typescript
// Query: 
// SELECT COUNT(*) FROM notifications 
// WHERE user_id = :userId AND is_read = FALSE

const count = await notificationRepository.count({
  where: { userId, isRead: false }
});
```

#### 8. 알림 읽음 처리

```typescript
// Query: UPDATE notifications SET is_read = TRUE WHERE id = :notificationId AND user_id = :userId

await notificationRepository.update(
  { id: notificationId, userId },
  { isRead: true }
);
```

#### 9. 알림 발송 (전체 사용자)

```typescript
// Query 1: SELECT id FROM users WHERE is_active = TRUE
const activeUsers = await userRepository.find({
  where: { isActive: true },
  select: ['id']
});

// Query 2: INSERT INTO notifications (user_id, title, content, type) VALUES ...
// (Bulk insert)
const notifications = activeUsers.map(user => 
  notificationRepository.create({
    userId: user.id,
    title,
    content,
    type
  })
);
await notificationRepository.insert(notifications);
```

---

## Performance Considerations

### 1. Notification 테이블 최적화

- **Index on (user_id, created_at)**: 사용자별 알림 리스트 조회 시 필수
- **Index on (user_id, is_read)**: 읽지 않은 알림 개수 조회 시 필수
- **Pagination**: 알림 리스트는 항상 페이지네이션 적용 (기본 20개)
- **Soft Delete 대신 Hard Delete**: 오래된 알림은 주기적으로 삭제 (예: 90일 이상)

### 2. Friendship 양방향 조회 최적화

- **Index on user_id, friend_id**: 양방향 조회 시 성능 향상
- **user_id < friend_id 정책**: 중복 데이터 방지로 스토리지 절약
- **JOIN 최소화**: User 정보는 필요한 필드만 SELECT

### 3. 캡슐 참여 내역 조회 최적화

- **UNION 대신 OR 조건 사용**: 쿼리 최적화
- **CapsuleParticipantSlot 인덱스**: capsule_id, user_id에 복합 인덱스
- **Lazy Loading 방지**: 관계 데이터는 JOIN으로 한 번에 로드

---

## Migration Scripts

### Create Notifications Table

```sql
-- Enum 타입 생성
CREATE TYPE notification_type_enum AS ENUM (
  'CAPSULE_OPEN',
  'FRIEND_REQUEST',
  'FRIEND_ACCEPTED',
  'SYSTEM',
  'MARKETING'
);

-- Notifications 테이블 생성
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  type notification_type_enum NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스 생성
CREATE INDEX idx_notifications_user_id_created_at ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_user_id_is_read ON notifications(user_id, is_read);

-- 코멘트 추가
COMMENT ON TABLE notifications IS '사용자 알림 관리 테이블';
COMMENT ON COLUMN notifications.user_id IS '알림 수신자';
COMMENT ON COLUMN notifications.type IS '알림 타입: CAPSULE_OPEN, FRIEND_REQUEST, FRIEND_ACCEPTED, SYSTEM, MARKETING';
COMMENT ON COLUMN notifications.is_read IS '읽음 여부';
```

---

## Data Validation Rules

### User Entity

- **nickname**: 
  - 2-20자 길이
  - 한글, 영문, 숫자만 허용
  - 금지어 체크 (욕설, 비속어)
  - 중복 불가

- **email**: 
  - 이메일 형식 검증
  - 최대 100자

- **phoneNumber**: 
  - 010-XXXX-XXXX 형식
  - 숫자만 허용
  - 중복 불가

- **profileImg**: 
  - S3 URL 형식
  - 이미지 파일만 허용 (jpeg, png, webp)
  - 최대 5MB

### Friendship Entity

- **userId, friendId**: 
  - userId < friendId 정렬 강제
  - 자기 자신과의 관계 불가
  - 중복 관계 불가

- **status**: 
  - PENDING, ACCEPTED, BLOCKED만 허용

### Notification Entity

- **title**: 
  - 최대 100자
  - 빈 문자열 불가

- **content**: 
  - 최대 1000자
  - 빈 문자열 불가

- **type**: 
  - NotificationType enum 값만 허용

---

## Security Considerations

### 1. 데이터 접근 권한

- **프로필 조회/수정**: 본인만 가능 (userId 검증)
- **친구 관계 삭제**: 본인이 포함된 관계만 가능
- **알림 조회/읽음 처리**: 본인의 알림만 가능
- **알림 발송**: 관리자 권한 필요

### 2. 민감 정보 보호

- **phoneNumber**: 친구 검색용으로만 노출, API 응답에서 마스킹 고려
- **email**: 본인 프로필 조회 시만 노출
- **passwordHash**: 절대 API 응답에 포함하지 않음

### 3. SQL Injection 방지

- TypeORM Parameterized Query 사용
- 사용자 입력 값 검증 (class-validator)

### 4. Rate Limiting

- 알림 발송 API: 관리자 권한 + Rate Limit 적용 (예: 1분에 10회)
- 친구 추가 API: Rate Limit 적용 (예: 1분에 5회)

---

## Future Enhancements

### 1. Notification 확장

- **metadata** JSONB 컬럼 추가: 알림 관련 추가 정보 저장 (capsuleId, friendshipId 등)
- **link** VARCHAR 컬럼 추가: 알림 클릭 시 이동할 딥링크
- **expires_at** TIMESTAMP 컬럼 추가: 알림 만료일 (마케팅 알림용)

### 2. Friendship 확장

- **requested_by** UUID 컬럼 추가: 누가 먼저 친구 요청했는지 추적
- **message** TEXT 컬럼 추가: 친구 요청 메시지

### 3. User 확장

- **last_login_at** TIMESTAMP: 마지막 로그인 일시
- **notification_token** VARCHAR: FCM/APNs 푸시 토큰

---

## Summary

- **기존 엔티티 활용**: User, Friendship (최소한의 변경)
- **신규 엔티티**: Notification (알림 기능 구현)
- **인덱스 최적화**: 조회 성능 극대화
- **보안 고려**: 권한 검증, 민감 정보 보호
- **확장 가능성**: 향후 기능 추가를 위한 유연한 구조

