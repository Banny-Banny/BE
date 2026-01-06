# Playwright E2E Tests

Banny-Banny 백엔드 API의 E2E 테스트 모음입니다.

## 📁 테스트 파일 목록

| 파일 | 설명 | 테스트 개수 |
|------|------|-------------|
| `auth.spec.ts` | 인증 관련 테스트 | 15개 |
| `me.spec.ts` | 마이페이지 기능 테스트 | 35개 |
| `capsules.spec.ts` | 캡슐 CRUD 테스트 | - |
| `capsule-entries.spec.ts` | 캡슐 엔트리 테스트 | - |
| `capsule-slots.spec.ts` | 캡슐 슬롯 테스트 | - |
| `media.spec.ts` | 미디어 업로드 테스트 | - |
| `orders.spec.ts` | 주문 테스트 | - |
| `payments.spec.ts` | 결제 테스트 | - |

## 🧪 me.spec.ts 테스트 범위

### 1. 프로필 관리 (6개 테스트)
- ✅ `GET /api/me` - 내 프로필 조회
- ✅ `POST /api/me/update` - 프로필 수정 (닉네임, 이메일)
- ✅ `POST /api/me/settings` - 알림 설정 수정

### 2. 타임캡슐 (3개 테스트)
- ✅ `GET /api/me/capsules` - 참여중인 캡슐 리스트
- ✅ 페이지네이션 테스트
- ✅ 빈 목록 처리

### 3. 친구 관리 (9개 테스트)
- ✅ `GET /api/me/friends` - 친구 목록 조회
- ✅ `POST /api/me/friends` - 친구 추가
- ✅ `DELETE /api/me/friends/:friendshipId` - 친구 삭제
- ✅ 중복 친구 추가 방지
- ✅ 자기 자신 추가 방지
- ✅ 권한 검증

### 4. 알림 관리 (12개 테스트)
- ✅ `GET /api/me/notifications` - 알림 목록
- ✅ `GET /api/me/notifications/unread-count` - 읽지 않은 알림 개수
- ✅ `POST /api/me/notifications/:notificationId/read` - 알림 읽음 처리
- ✅ 멱등성 테스트
- ✅ 권한 검증

### 5. 관리자 기능 (3개 테스트)
- ✅ `POST /api/admin/notifications` - 알림 발송
- ✅ 단일 사용자 발송
- ✅ 대량 발송

## 🔧 환경 설정

### 1. 테스트 DB 설정

프로젝트 루트에 `.env.test` 파일 생성:

```bash
# PostgreSQL (테스트 DB)
TEST_DB_HOST=localhost
TEST_DB_PORT=5432
TEST_DB_USERNAME=postgres
TEST_DB_PASSWORD=postgres
TEST_DB_DATABASE=banny_banny_test

# API 서버
API_BASE_URL=http://localhost:3000

# JWT
JWT_SECRET=banny-banny-jwt-secret-key-2025

# AWS S3 (선택적)
AWS_REGION=ap-northeast-2
S3_BUCKET=your-test-bucket
```

### 2. 테스트 DB 생성

```bash
# PostgreSQL 접속
psql -U postgres

# 테스트 DB 생성
CREATE DATABASE banny_banny_test;

# 종료
\q
```

### 3. 마이그레이션 실행

```bash
# 테스트 DB에 스키마 적용
NODE_ENV=test npm run migration:run
```

## 🚀 테스트 실행

### 전체 테스트 실행
```bash
npm run test:e2e
```

### 특정 파일만 실행
```bash
# me.spec.ts만 실행
npx playwright test tests/playwright/me.spec.ts

# auth.spec.ts만 실행
npx playwright test tests/playwright/auth.spec.ts
```

### 특정 테스트만 실행
```bash
# 테스트 이름으로 필터링
npx playwright test -g "프로필 조회"
npx playwright test -g "친구 추가"
```

### 디버그 모드
```bash
# UI 모드로 실행
npx playwright test --ui

# 특정 테스트 디버그
npx playwright test tests/playwright/me.spec.ts --debug
```

### 병렬 실행
```bash
# 워커 수 지정
npx playwright test --workers=4

# 순차 실행
npx playwright test --workers=1
```

## 📊 테스트 결과 확인

### HTML 리포트 생성
```bash
npx playwright test --reporter=html
```

### 리포트 열기
```bash
npx playwright show-report
```

## ⚠️ 주의사항

### 1. 테스트 DB 격리
- **절대로 운영 DB를 테스트에 사용하지 마세요!**
- `TEST_DB_*` 환경변수를 사용하여 테스트 DB를 분리합니다
- 각 테스트 후 생성된 데이터는 자동으로 정리됩니다 (cleanup 함수)

### 2. API 서버 실행 필수
```bash
# 테스트 전에 서버가 실행중이어야 합니다
npm run start:dev

# 또는 테스트용 서버
NODE_ENV=test npm run start:dev
```

### 3. 환경변수 보안
- `.env.test` 파일은 `.gitignore`에 포함되어 있습니다
- **절대로 시크릿 키를 커밋하지 마세요**
- GitHub Secret Scanning이 활성화되어 있습니다

### 4. 병렬 실행 주의
- 같은 DB를 사용하는 테스트는 경쟁 조건(race condition)이 발생할 수 있습니다
- 필요시 `--workers=1`로 순차 실행하세요

## 🔍 트러블슈팅

### 테스트 실패 시

1. **서버 실행 확인**
   ```bash
   curl http://localhost:3000/api/health
   ```

2. **DB 연결 확인**
   ```bash
   psql -U postgres -d banny_banny_test -c "SELECT 1"
   ```

3. **마이그레이션 상태 확인**
   ```bash
   npm run migration:show
   ```

4. **테스트 DB 초기화**
   ```bash
   # DB 삭제 후 재생성
   psql -U postgres -c "DROP DATABASE banny_banny_test"
   psql -U postgres -c "CREATE DATABASE banny_banny_test"
   
   # 마이그레이션 재실행
   NODE_ENV=test npm run migration:run
   ```

### 포트 충돌

기본 포트(3000)가 사용중인 경우:
```bash
# .env.test에서 포트 변경
API_BASE_URL=http://localhost:3001

# 서버도 해당 포트로 실행
PORT=3001 npm run start:dev
```

## 📝 테스트 작성 가이드

### 기본 구조

```typescript
test('GET /api/me 200: 설명', async () => {
  // 1. 테스트 데이터 생성
  const user = await createUser('테스트유저', 'test@example.com');

  // 2. API 요청
  const res = await api.get('/api/me', {
    headers: { Authorization: `Bearer ${user.token}` },
  });

  // 3. 응답 검증
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.nickname).toBe('테스트유저');

  // 4. 정리 (cleanup)
  await cleanupUser(user.id);
});
```

### Helper 함수

```typescript
// 사용자 생성
const user = await createUser(nickname, email);

// 캡슐 생성
const capsuleId = await createCapsule(userId, viewLimit, roomStatus);

// 친구 관계 생성
const friendshipId = await createFriendship(userId1, userId2, status);

// 알림 생성
const notificationId = await createNotification(userId, title, content, type);

// 정리
await cleanupUser(userId);
await cleanupFriendships(userId1, userId2);
await cleanupNotifications(userId);
```

## 🎯 커버리지 목표

- [x] 프로필 관리: 100%
- [x] 친구 관리: 100%
- [x] 알림 관리: 100%
- [x] 타임캡슐 리스트: 100%
- [ ] 프로필 이미지 업로드: 추후 추가 (multipart/form-data 테스트)

## 📚 참고 자료

- [Playwright 공식 문서](https://playwright.dev/)
- [Playwright Test API](https://playwright.dev/docs/api/class-test)
- [pg (PostgreSQL Client)](https://node-postgres.com/)

