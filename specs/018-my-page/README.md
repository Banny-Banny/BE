# Feature 018: My Page (마이페이지)

## 📋 개요

마이페이지 API를 구현하여 사용자가 프로필을 관리하고, 친구를 추가/삭제하며, 참여중인 타임캡슐을 조회하고, 알림을 관리할 수 있도록 합니다.

**생성일**: 2026-01-06  
**상태**: Draft  
**우선순위**: High (P1)

---

## 🎯 핵심 기능

### 1. 프로필 관리 (P1)
- ✅ 내 프로필 조회
- ✅ 닉네임, 이메일 수정
- ✅ 프로필 이미지 업로드 (S3)
- ✅ 알림 설정 (푸시/마케팅 동의)

### 2. 타임캡슐 참여 내역 (P1)
- ✅ 참여중인 캡슐 리스트 조회
- ✅ 소유 캡슐 + 참여 캡슐 통합 조회
- ✅ 페이지네이션 지원

### 3. 친구 관리 (P2)
- ✅ 친구 목록 조회
- ✅ 전화번호로 친구 추가
- ✅ 친구 삭제
- ✅ 중복 체크 및 권한 검증

### 4. 알림 관리 (P3)
- ✅ 알림 리스트 조회
- ✅ 읽지 않은 알림 개수 조회
- ✅ 알림 읽음 처리
- ✅ 관리자 알림 발송 (관리자 전용)

---

## 📁 문서 구조

```
specs/018-my-page/
├── README.md           # 이 파일 (기능 요약)
├── spec.md             # 기능 명세 (User Stories, Requirements, Success Criteria)
├── plan.md             # 구현 계획 (기술 스택, API 설계, 데이터 모델)
├── tasks.md            # 구현 태스크 리스트 (78개 태스크)
└── data-model.md       # 데이터 모델 상세 (엔티티, 관계, 쿼리 패턴)
```

---

## 🚀 API 엔드포인트

### 프로필 관리

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/me` | 내 프로필 조회 | JWT |
| PATCH | `/api/me` | 프로필 수정 (닉네임, 이메일) | JWT |
| POST | `/api/me/profile-image` | 프로필 이미지 업로드 URL 요청 | JWT |
| PATCH | `/api/me/settings` | 알림 설정 수정 | JWT |

### 타임캡슐

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/me/capsules` | 참여중인 캡슐 리스트 | JWT |

### 친구 관리

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/me/friends` | 친구 목록 조회 | JWT |
| POST | `/api/me/friends` | 친구 추가 (전화번호) | JWT |
| DELETE | `/api/me/friends/:friendshipId` | 친구 삭제 | JWT |

### 알림 관리

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/me/notifications` | 알림 리스트 조회 | JWT |
| GET | `/api/me/notifications/unread-count` | 읽지 않은 알림 개수 | JWT |
| PATCH | `/api/me/notifications/:id/read` | 알림 읽음 처리 | JWT |

### 관리자 기능

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/admin/notifications` | 알림 발송 (단일/전체) | Admin |

---

## 🗄️ 데이터 모델

### 기존 엔티티 (재사용)

- **User**: 사용자 기본 정보 (nickname, profileImg, isPushAgreed 등)
- **Friendship**: 친구 관계 (user_id < friend_id 정렬, status)
- **Capsule**: 타임캡슐 메타데이터
- **CapsuleParticipantSlot**: 캡슐 참여 슬롯

### 신규 엔티티

- **Notification**: 알림 데이터 (userId, title, content, type, isRead, createdAt)

**Notification Type Enum**:
- `CAPSULE_OPEN`: 타임캡슐 오픈 알림
- `FRIEND_REQUEST`: 친구 요청 알림
- `FRIEND_ACCEPTED`: 친구 수락 알림
- `SYSTEM`: 시스템 공지
- `MARKETING`: 마케팅 알림

---

## 🛠️ 기술 스택

- **Framework**: NestJS 10.x
- **Language**: TypeScript 5.x
- **ORM**: TypeORM
- **Database**: PostgreSQL
- **Storage**: AWS S3 (프로필 이미지)
- **Authentication**: JWT
- **Testing**: Jest + Playwright

---

## 📦 구현 단계

### Phase 1: Setup (T001-T004)
- 모듈 디렉토리 생성
- Notification 엔티티 파일 생성
- Enum 및 공통 DTO 정의

### Phase 2: Foundational (T005-T010) ⚠️ CRITICAL
- Notification 엔티티 구현
- 마이그레이션 생성 및 실행
- MeModule 기본 구조 생성

### Phase 3-8: User Stories (T011-T061)
- **US1**: 프로필 관리 (T011-T026) - MVP
- **US2**: 타임캡슐 리스트 (T027-T030) - MVP
- **US3**: 친구 관리 (T031-T042)
- **US4**: 알림 설정 (T043-T045) - US1에 포함됨
- **US5**: 알림 조회/관리 (T046-T057)
- **US6**: 관리자 알림 발송 (T058-T061)

### Phase 9-11: Documentation & Testing (T062-T078)
- Swagger 문서화
- E2E 테스트
- 최종 정리 및 통합

**총 태스크 수**: 78개

---

## ✅ Success Criteria

- ✅ 프로필 조회 응답 시간 p95 < 200ms
- ✅ 중복 닉네임/친구 요청 100% 차단
- ✅ 참여중인 캡슐 100% 정확한 조회
- ✅ 읽지 않은 알림 개수 100% 일치
- ✅ 권한 없는 접근 100% 차단 (403)
- ✅ 프로필 이미지 형식/크기 검증 100%

---

## 🔒 보안 고려사항

1. **인증**: 모든 엔드포인트에 JWT 인증 적용
2. **권한**: 본인 데이터만 접근 가능 (userId 검증)
3. **관리자**: AdminGuard로 관리자 권한 체크
4. **Rate Limiting**: 친구 추가, 알림 발송 API 제한
5. **데이터 검증**: class-validator로 입력값 검증

---

## 📊 성능 최적화

1. **Notification 인덱스**:
   - `(user_id, created_at)`: 알림 리스트 조회
   - `(user_id, is_read)`: 읽지 않은 개수 조회

2. **Friendship 양방향 조회**:
   - user_id < friend_id 정책으로 중복 방지
   - JOIN으로 User 정보 한 번에 로드

3. **Capsule 참여 내역**:
   - OR 조건으로 소유/참여 캡슐 통합 조회
   - 페이지네이션 적용 (기본 20개)

---

## 🧪 테스트 전략

### Unit Tests
- MeService, FriendsService, NotificationsService 로직 테스트
- 중복 체크, 권한 검증, 페이지네이션 테스트

### Integration Tests
- Controller 엔드포인트 동작 확인
- JWT 인증 통합 테스트
- 데이터베이스 통합 테스트

### E2E Tests (Playwright)
- 프로필 조회 및 수정 시나리오
- 친구 추가 → 조회 → 삭제 시나리오
- 알림 발송 → 조회 → 읽음 처리 시나리오

---

## 🚀 배포 계획

### MVP (User Story 1, 2)
1. Setup + Foundational 완료
2. 프로필 관리 + 타임캡슐 조회 구현
3. 테스트 및 검증
4. 첫 배포

### Incremental Delivery
1. US1 + US2 → MVP 배포
2. US3 → 친구 기능 추가
3. US5 → 알림 기능 추가
4. US6 → 관리자 기능 추가

각 단계마다 독립적으로 배포 가능!

---

## 🔮 향후 개선사항

- [ ] 친구 요청 승인/거부 흐름 추가
- [ ] 실시간 푸시 알림 연동 (FCM, APNs)
- [ ] 알림 카테고리별 필터링
- [ ] 프로필 이미지 썸네일 생성
- [ ] 친구 추천 기능 (전화번호 기반)
- [ ] 알림 일괄 삭제 기능

---

## 📚 참고 문서

- [spec.md](./spec.md) - 상세 기능 명세
- [plan.md](./plan.md) - 구현 계획 및 기술 설계
- [tasks.md](./tasks.md) - 구현 태스크 리스트
- [data-model.md](./data-model.md) - 데이터 모델 상세

---

## 📞 문의

기능 구현 관련 문의는 프로젝트 팀에 문의해주세요.

