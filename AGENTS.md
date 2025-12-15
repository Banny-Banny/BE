# Banny-Banny Backend Agent Context

## Project Overview

Banny-Banny는 타임캡슐 서비스의 백엔드 API 서버입니다.

## Tech Stack

- **Framework**: NestJS (Node.js)
- **Language**: TypeScript
- **Database**: PostgreSQL with TypeORM
- **Authentication**: Kakao OAuth + JWT
- **API Documentation**: Swagger
- **Package Manager**: npm

## Project Structure

```
src/
├── auth/           # 인증 모듈 (카카오 소셜로그인, JWT)
├── common/         # 공통 유틸리티, Enum
├── database/       # TypeORM 설정
├── entities/       # 데이터베이스 엔티티
└── main.ts         # 애플리케이션 진입점
```

## Database Entities

- `users` - 사용자 정보
- `products` - 상품 (유료/무료 아이템)
- `capsules` - 타임캡슐
- `capsule_access_logs` - 캡슐 조회 로그
- `orders` - 주문
- `payments` - 결제
- `friendships` - 친구 관계
- `customer_services` - 고객 문의

## Commands

```bash
# 개발 서버 실행
npm run start:dev

# 빌드
npm run build

# 린트
npm run lint

# 테스트
npm run test
```

## API Endpoints

- `GET /api/health` - 서버 상태 확인
- `GET /api/auth/kakao` - 카카오 로그인
- `GET /api/auth/me` - 내 정보 조회
- `GET /api/auth/verify` - 토큰 검증

## Swagger Documentation

서버 실행 후 접속: `http://localhost:3000/api/docs`

## Git Commit Convention

Conventional Commits 방식 사용:
- `feat(scope): [날짜] 설명` - 새 기능
- `fix(scope): [날짜] 설명` - 버그 수정
- `chore: [날짜] 설명` - 기타 작업
- `docs: [날짜] 설명` - 문서

## Spec-Kit Commands

- `/speckit.specify` - 새 기능 명세 생성
- `/speckit.plan` - 구현 계획 수립
- `/speckit.tasks` - 태스크 분해
- `/speckit.implement` - 구현 실행

