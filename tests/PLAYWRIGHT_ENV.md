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
JWT_SECRET=banny-banny-jwt-secret-key-2025
```

프로젝트 루트에 `.env.test`를 생성하면 `tests/playwright/capsules.spec.ts`에서 자동으로 로드됩니다.

## ⚠️ 중요: 보안 주의사항

**절대로 `.env.test` 파일을 Git에 커밋하지 마세요!**

- `.env.test`는 `.gitignore`에 포함되어 있습니다
- AWS 자격 증명, 시크릿 키 등 민감한 정보는 **절대** 커밋하지 마세요
- GitHub의 Secret Scanning이 활성화되어 있으며, 시크릿이 감지되면 push가 차단됩니다

만약 실수로 시크릿을 커밋한 경우:
1. 즉시 해당 시크릿을 무효화/회전하세요
2. Git 히스토리에서 제거하세요: `git filter-branch --force --index-filter 'git rm --cached --ignore-unmatch .env.test' --prune-empty --tag-name-filter cat -- --all`
3. 강제 push: `git push --force`

