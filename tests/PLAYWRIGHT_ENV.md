# Playwright E2E Test Environment

플레이wright 캡슐 E2E 테스트는 테스트용 DB를 사용하도록 `TEST_DB_*` 환경 변수를 우선합니다.

## 필수 환경변수
- `TEST_DB_HOST` (기본: `localhost`)
- `TEST_DB_PORT` (기본: `5432`)
- `TEST_DB_USERNAME`
- `TEST_DB_PASSWORD`
- `TEST_DB_DATABASE` (기본: `banny_banny_test`)
- `API_BASE_URL` (기본: `http://localhost:3000`)

## 예시 (.env.test)
```
TEST_DB_HOST=localhost
TEST_DB_PORT=5432
TEST_DB_USERNAME=postgres
TEST_DB_PASSWORD=postgres
TEST_DB_DATABASE=banny_banny_test
API_BASE_URL=http://localhost:3000
```

프로젝트 루트에 `.env.test`를 생성하면 `tests/playwright/capsules.spec.ts`에서 자동으로 로드됩니다.

