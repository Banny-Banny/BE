# Banny-Banny Backend Constitution

## Core Principles

### I. 모듈 기반 아키텍처
모든 기능은 NestJS 모듈로 분리하여 개발합니다. 각 모듈은 독립적으로 테스트 가능하고 명확한 책임을 가져야 합니다.

### II. API 우선 설계
모든 엔드포인트는 Swagger 문서화를 포함해야 합니다. RESTful 원칙을 따르고, 일관된 응답 형식을 유지합니다.

### III. 타입 안전성
TypeScript의 강타입 시스템을 최대한 활용합니다. `any` 타입 사용을 지양하고, 인터페이스와 타입을 명시적으로 정의합니다.

### IV. 테스트 주도 개발 (권장)
새로운 기능 개발 시 테스트 코드 작성을 권장합니다. 최소한 핵심 비즈니스 로직은 테스트로 커버해야 합니다.

### V. 보안 우선
인증/인가가 필요한 엔드포인트에는 반드시 가드를 적용합니다. 민감한 정보는 환경변수로 관리하고, 절대 코드에 하드코딩하지 않습니다.

## 기술 표준

### 데이터베이스
- PostgreSQL + TypeORM 사용
- 엔티티 정의 시 명시적 컬럼 타입 지정
- Soft Delete 패턴 적용 (사용자 데이터)

### 인증
- 카카오 OAuth 2.0 소셜 로그인
- JWT 기반 토큰 인증
- Access Token 만료: 7일

### 코드 스타일
- ESLint + Prettier 규칙 준수
- 린트 에러 0개 유지
- 빌드 성공 필수

## 개발 워크플로우

### Git 브랜치 전략
- `main`: 프로덕션 배포 브랜치
- `feature/*`: 기능 개발 브랜치
- `fix/*`: 버그 수정 브랜치

### 커밋 컨벤션
Conventional Commits 형식을 따릅니다:
```
feat(scope): [YYYY-MM-DD] 설명
fix(scope): [YYYY-MM-DD] 설명
chore: [YYYY-MM-DD] 설명
```

## Governance

이 Constitution은 프로젝트의 모든 개발 활동에 우선합니다. 변경이 필요한 경우 팀 합의를 거쳐 문서화합니다.

**Version**: 1.0.0 | **Ratified**: 2025-12-12 | **Last Amended**: 2025-12-12
