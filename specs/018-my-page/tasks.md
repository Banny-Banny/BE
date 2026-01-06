# Tasks: My Page (마이페이지)

**Input**: Design documents from `/specs/018-my-page/`  
**Prerequisites**: plan.md (required), spec.md (required for user stories)

**Tests**: E2E 테스트는 핵심 시나리오에만 포함합니다.

**Organization**: 태스크는 사용자 스토리별로 그룹화하여 각 스토리를 독립적으로 구현하고 테스트할 수 있도록 합니다.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 병렬 실행 가능 (다른 파일, 의존성 없음)
- **[Story]**: 소속 사용자 스토리 (US1, US2, US3 등)
- 파일 경로는 정확하게 명시

## Phase 1: Setup (공통 인프라)

**Purpose**: 프로젝트 초기화 및 기본 구조 생성

- [ ] T001 마이페이지 모듈 디렉토리 생성 `src/me/`
- [ ] T002 Notification 엔티티 파일 생성 `src/entities/notification.entity.ts`
- [ ] T003 [P] NotificationType Enum 정의 `src/common/enums/notification-type.enum.ts`
- [ ] T004 [P] 공통 페이지네이션 DTO 생성 `src/me/dto/pagination.dto.ts`

---

## Phase 2: Foundational (필수 선행 작업)

**Purpose**: 모든 사용자 스토리에서 필요한 핵심 인프라

**⚠️ CRITICAL**: 이 단계가 완료되어야 사용자 스토리 구현 시작 가능

- [ ] T005 Notification 엔티티 구현 (id, userId, title, content, type, isRead, createdAt, User 관계)
- [ ] T006 User 엔티티에 notifications OneToMany 관계 추가
- [ ] T007 Notification 테이블 마이그레이션 파일 생성 `src/migrations/XXXXXXXX-create-notifications-table.ts`
- [ ] T008 마이그레이션 실행 및 확인 `npm run migration:run`
- [ ] T009 MeModule 생성 `src/me/me.module.ts` (기본 구조, TypeORM 엔티티 등록)
- [ ] T010 [P] JWT 인증 가드 import 확인 (AuthModule에서 export 확인)

**Checkpoint**: 기반 인프라 준비 완료 - 사용자 스토리 구현 시작 가능

---

## Phase 3: User Story 1 - 내 프로필 조회 및 수정 (Priority: P1) 🎯 MVP

**Goal**: 사용자가 자신의 프로필을 조회하고 닉네임, 이메일, 프로필 이미지를 수정할 수 있다.

**Independent Test**: GET /api/me로 프로필 조회 → PATCH /api/me로 닉네임 수정 → 다시 조회하여 변경 확인

### Implementation for User Story 1

- [ ] T011 [P] [US1] ProfileResponseDto 생성 `src/me/dto/profile-response.dto.ts`
- [ ] T012 [P] [US1] UpdateProfileDto 생성 `src/me/dto/update-profile.dto.ts` (nickname, email 필드, validation)
- [ ] T013 [P] [US1] UpdateSettingsDto 생성 `src/me/dto/update-settings.dto.ts` (isPushAgreed, isMarketingAgreed)
- [ ] T014 [P] [US1] ProfileImageUploadDto 생성 `src/me/dto/profile-image-upload.dto.ts` (contentType, fileSize)
- [ ] T015 [US1] MeService 생성 `src/me/me.service.ts` (의존성: UserRepository)
- [ ] T016 [US1] MeService.getMyProfile(userId) 메서드 구현 - User 조회 및 필요한 필드만 반환
- [ ] T017 [US1] MeService.updateProfile(userId, dto) 메서드 구현 - 닉네임 중복 체크, 업데이트
- [ ] T018 [US1] MeService.updateSettings(userId, dto) 메서드 구현 - 알림 설정 업데이트
- [ ] T019 [US1] MeService.requestProfileImageUpload(userId, dto) 메서드 구현 - MediaService 호출하여 presigned URL 생성
- [ ] T020 [US1] MeService.updateProfileImageUrl(userId, imageUrl) 메서드 구현 - profileImg 필드 업데이트
- [ ] T021 [US1] MeController 생성 `src/me/me.controller.ts`
- [ ] T022 [US1] MeController에 GET /api/me 엔드포인트 구현 (@UseGuards(JwtAuthGuard), @CurrentUser() 사용)
- [ ] T023 [US1] MeController에 PATCH /api/me 엔드포인트 구현 (프로필 수정)
- [ ] T024 [US1] MeController에 PATCH /api/me/settings 엔드포인트 구현 (알림 설정)
- [ ] T025 [US1] MeController에 POST /api/me/profile-image 엔드포인트 구현 (presigned URL 요청)
- [ ] T026 [US1] MeModule에 MeController, MeService 등록 및 MediaModule import

**Checkpoint**: 프로필 조회 및 수정 기능 완료, 독립적으로 테스트 가능

---

## Phase 4: User Story 2 - 참여중인 타임캡슐 리스트 조회 (Priority: P1)

**Goal**: 사용자가 소유하거나 참여중인 타임캡슐 목록을 조회할 수 있다.

**Independent Test**: GET /api/me/capsules로 캡슐 리스트 조회, 소유 캡슐과 참여 캡슐 모두 포함 확인

### Implementation for User Story 2

- [ ] T027 [P] [US2] CapsuleListResponseDto 생성 `src/me/dto/capsule-list-response.dto.ts` (id, title, status, openDate, participantCount, myWriteStatus)
- [ ] T028 [P] [US2] PaginatedCapsuleResponseDto 생성 `src/me/dto/paginated-capsule-response.dto.ts` (items, total, limit, offset)
- [ ] T029 [US2] MeService.getMyCapsules(userId, limit, offset) 메서드 구현
  - Capsule.userId = userId (소유 캡슐) 조회
  - CapsuleParticipantSlot.userId = userId (참여 캡슐) 조회
  - UNION 또는 LEFT JOIN으로 합치기
  - 참여자 수 계산
  - 내 작성 상태 확인 (CapsuleEntry 존재 여부)
  - 페이지네이션 적용
- [ ] T030 [US2] MeController에 GET /api/me/capsules 엔드포인트 구현 (query params: limit, offset)

**Checkpoint**: 참여중인 타임캡슐 조회 기능 완료

---

## Phase 5: User Story 3 - 친구 관리 (Priority: P2)

**Goal**: 사용자가 친구 목록을 조회하고, 전화번호로 친구를 추가하거나 삭제할 수 있다.

**Independent Test**: 친구 추가 → 목록 조회 → 친구 삭제 순차 실행하여 동작 확인

### Implementation for User Story 3

- [ ] T031 [P] [US3] FriendListResponseDto 생성 `src/me/dto/friend-list-response.dto.ts` (id, userId, friendId, status, user/friend 프로필)
- [ ] T032 [P] [US3] PaginatedFriendResponseDto 생성 `src/me/dto/paginated-friend-response.dto.ts`
- [ ] T033 [P] [US3] AddFriendDto 생성 `src/me/dto/add-friend.dto.ts` (phoneNumber, validation)
- [ ] T034 [US3] FriendsService 생성 `src/me/friends.service.ts` (의존성: FriendshipRepository, UserRepository)
- [ ] T035 [US3] FriendsService.getFriends(userId, limit, offset) 메서드 구현
  - userId가 포함된 Friendship 양방향 조회
  - 상대방 User 정보 JOIN
  - 페이지네이션 적용
- [ ] T036 [US3] FriendsService.addFriend(userId, phoneNumber) 메서드 구현
  - 전화번호로 대상 User 조회
  - 자기 자신 체크 (400)
  - 중복 관계 체크 (409)
  - user_id < friend_id 정렬 후 Friendship 생성 (status: ACCEPTED)
- [ ] T037 [US3] FriendsService.removeFriend(userId, friendshipId) 메서드 구현
  - Friendship 조회
  - userId 권한 확인 (403)
  - 삭제
- [ ] T038 [US3] FriendsController 생성 `src/me/friends.controller.ts`
- [ ] T039 [US3] FriendsController에 GET /api/me/friends 엔드포인트 구현
- [ ] T040 [US3] FriendsController에 POST /api/me/friends 엔드포인트 구현
- [ ] T041 [US3] FriendsController에 DELETE /api/me/friends/:friendshipId 엔드포인트 구현
- [ ] T042 [US3] MeModule에 FriendsController, FriendsService 등록

**Checkpoint**: 친구 관리 기능 완료

---

## Phase 6: User Story 4 - 알림 설정 관리 (Priority: P2)

**Goal**: 사용자가 푸시 알림, 마케팅 알림 수신 동의를 설정할 수 있다.

**Independent Test**: PATCH /api/me/settings로 알림 설정 변경 → GET /api/me로 변경 확인

### Implementation for User Story 4

- [ ] T043 [US4] UpdateSettingsDto는 T013에서 이미 생성됨 ✅
- [ ] T044 [US4] MeService.updateSettings는 T018에서 이미 구현됨 ✅
- [ ] T045 [US4] MeController의 PATCH /api/me/settings는 T024에서 이미 구현됨 ✅

**Checkpoint**: 알림 설정 관리 기능은 User Story 1에서 이미 구현 완료 ✅

---

## Phase 7: User Story 5 - 알림 조회 및 관리 (Priority: P3)

**Goal**: 사용자가 최근 알림을 조회하고, 읽지 않은 알림 개수를 확인하며, 알림을 읽음 처리할 수 있다.

**Independent Test**: 알림 목록 조회 → 읽지 않은 개수 조회 → 알림 읽음 처리 → 개수 감소 확인

### Implementation for User Story 5

- [ ] T046 [P] [US5] NotificationResponseDto 생성 `src/me/dto/notification-response.dto.ts` (id, title, content, type, isRead, createdAt)
- [ ] T047 [P] [US5] PaginatedNotificationResponseDto 생성 `src/me/dto/paginated-notification-response.dto.ts`
- [ ] T048 [P] [US5] UnreadCountResponseDto 생성 `src/me/dto/unread-count-response.dto.ts` (count)
- [ ] T049 [US5] NotificationsService 생성 `src/me/notifications.service.ts` (의존성: NotificationRepository)
- [ ] T050 [US5] NotificationsService.getNotifications(userId, limit, offset) 메서드 구현
  - Notification.userId = userId 조회
  - ORDER BY createdAt DESC
  - 페이지네이션 적용
- [ ] T051 [US5] NotificationsService.getUnreadCount(userId) 메서드 구현
  - COUNT(*) WHERE userId = userId AND isRead = false
- [ ] T052 [US5] NotificationsService.markAsRead(userId, notificationId) 메서드 구현
  - Notification 조회
  - userId 권한 확인 (403)
  - isRead = true 업데이트
- [ ] T053 [US5] NotificationsController 생성 `src/me/notifications.controller.ts`
- [ ] T054 [US5] NotificationsController에 GET /api/me/notifications 엔드포인트 구현
- [ ] T055 [US5] NotificationsController에 GET /api/me/notifications/unread-count 엔드포인트 구현
- [ ] T056 [US5] NotificationsController에 PATCH /api/me/notifications/:notificationId/read 엔드포인트 구현
- [ ] T057 [US5] MeModule에 NotificationsController, NotificationsService 등록

**Checkpoint**: 알림 조회 및 관리 기능 완료

---

## Phase 8: User Story 6 - 알림 메시지 발송 (관리자 기능) (Priority: P3)

**Goal**: 관리자가 특정 사용자 또는 전체 사용자에게 알림을 발송할 수 있다.

**Independent Test**: 관리자 권한으로 알림 발송 → 대상 사용자의 알림 목록에서 확인

### Implementation for User Story 6

- [ ] T058 [P] [US6] SendNotificationDto 생성 `src/me/dto/send-notification.dto.ts` (targetType, userId?, title, content, type)
- [ ] T059 [P] [US6] AdminGuard 생성 또는 확인 `src/auth/guards/admin.guard.ts` (관리자 권한 체크)
- [ ] T060 [US6] NotificationsService.sendNotification(dto) 메서드 구현
  - targetType이 'USER'면 단일 Notification 생성
  - targetType이 'ALL'이면 모든 활성 사용자 조회 후 Bulk insert
- [ ] T061 [US6] NotificationsController에 POST /api/admin/notifications 엔드포인트 구현 (@UseGuards(AdminGuard) 적용)

**Checkpoint**: 관리자 알림 발송 기능 완료

---

## Phase 9: Swagger Documentation

**Purpose**: API 문서화

- [ ] T062 [P] MeController에 Swagger 데코레이터 추가 (@ApiTags, @ApiOperation, @ApiResponse 등)
- [ ] T063 [P] FriendsController에 Swagger 데코레이터 추가
- [ ] T064 [P] NotificationsController에 Swagger 데코레이터 추가
- [ ] T065 모든 DTO에 @ApiProperty 데코레이터 추가

---

## Phase 10: Testing (E2E)

**Purpose**: 핵심 시나리오 E2E 테스트

- [ ] T066 [P] Playwright E2E 테스트 파일 생성 `tests/playwright/me.spec.ts`
- [ ] T067 [P] 프로필 조회 및 수정 시나리오 테스트 작성
- [ ] T068 [P] 친구 추가 → 조회 → 삭제 시나리오 테스트 작성
- [ ] T069 [P] 알림 발송 → 조회 → 읽음 처리 시나리오 테스트 작성
- [ ] T070 [P] 참여중인 타임캡슐 조회 시나리오 테스트 작성
- [ ] T071 E2E 테스트 실행 및 검증 `npm run test:e2e`

---

## Phase 11: Polish & Integration

**Purpose**: 최종 정리 및 통합

- [ ] T072 [P] AppModule에 MeModule import 추가
- [ ] T073 [P] 에러 메시지 한글화 및 일관성 확인
- [ ] T074 [P] 로깅 추가 (주요 API 호출 시점)
- [ ] T075 코드 리뷰 및 리팩토링
- [ ] T076 린터 오류 수정 `npm run lint`
- [ ] T077 전체 테스트 실행 `npm run test && npm run test:e2e`
- [ ] T078 Swagger 문서 확인 `http://localhost:3000/api/docs`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 즉시 시작 가능
- **Foundational (Phase 2)**: Setup 완료 후 - 모든 사용자 스토리를 BLOCK
- **User Stories (Phase 3-8)**: Foundational 완료 후 시작 가능
  - 병렬 진행 가능 (팀 리소스 있을 경우)
  - 순차 진행 시 우선순위 순서: P1 → P2 → P3
- **Swagger & Testing (Phase 9-10)**: 해당 User Story 완료 후 각각 진행 가능
- **Polish (Phase 11)**: 모든 User Story 완료 후

### User Story Dependencies

- **User Story 1 (P1)**: Foundational 완료 후 시작 - 다른 스토리와 독립적
- **User Story 2 (P1)**: Foundational 완료 후 시작 - US1과 병렬 가능
- **User Story 3 (P2)**: Foundational 완료 후 시작 - 독립적
- **User Story 4 (P2)**: US1에서 이미 구현됨 ✅
- **User Story 5 (P3)**: Foundational 완료 후 시작 - 독립적
- **User Story 6 (P3)**: US5 완료 후 시작 (NotificationsService 의존)

### Within Each User Story

- DTO 생성 [P] → Service 구현 → Controller 구현 → Module 등록
- Tests는 구현 완료 후 작성

### Parallel Opportunities

- Setup 태스크 모두 병렬 실행 가능
- Foundational 태스크 일부 병렬 실행 가능 (T009, T010)
- 각 User Story 내 DTO 생성 태스크들은 병렬 실행 가능
- US1과 US2는 병렬 진행 가능 (다른 파일, 의존성 없음)
- US3, US5, US6은 독립적이므로 병렬 진행 가능
- Swagger 문서화 태스크 모두 병렬 실행 가능
- E2E 테스트 작성 태스크 모두 병렬 실행 가능

---

## Implementation Strategy

### MVP First (User Story 1, 2만)

1. Phase 1: Setup 완료
2. Phase 2: Foundational 완료 (CRITICAL)
3. Phase 3: User Story 1 완료 → 테스트
4. Phase 4: User Story 2 완료 → 테스트
5. **STOP and VALIDATE**: 프로필 관리 + 캡슐 조회 기능 검증
6. 배포/데모 가능

### Incremental Delivery

1. Setup + Foundational → 기반 완성
2. US1 + US2 → MVP 배포
3. US3 → 친구 기능 추가
4. US5 → 알림 기능 추가
5. US6 → 관리자 기능 추가
6. 각 단계마다 독립적으로 배포 가능

### Parallel Team Strategy

팀이 여러 명일 경우:

1. 모두 함께 Setup + Foundational 완료
2. Foundational 완료 후:
   - Developer A: US1 (프로필 관리)
   - Developer B: US2 (캡슐 조회)
   - Developer C: US3 (친구 관리)
3. 각 스토리 완료 후 통합 테스트

---

## Notes

- [P] 태스크는 병렬 실행 가능 (다른 파일, 의존성 없음)
- [Story] 라벨은 태스크를 특정 사용자 스토리에 매핑
- 각 User Story는 독립적으로 완료 및 테스트 가능
- Checkpoint마다 기능 검증 후 다음 단계 진행
- 커밋은 각 태스크 또는 논리적 그룹 단위로 수행
- 모호한 태스크, 파일 충돌, 스토리 간 의존성 최소화

