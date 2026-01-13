# 🐰 Banny-Banny Backend

> 추억을 담은 타임캡슐과 위치 기반 이스터에그 서비스

<p align="center">
  <img src="https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white" alt="NestJS" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/PostgreSQL-336791?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/AWS_S3-569A31?style=for-the-badge&logo=amazons3&logoColor=white" alt="AWS S3" />
</p>

---

## 📖 프로젝트 소개

**Banny-Banny**는 사용자들이 추억을 담은 타임캡슐을 생성하고, 위치 기반으로 이스터에그를 숨기며, 친구들과 공유할 수 있는 타임캡슐 서비스의 백엔드 API 서버입니다.

### 주요 기능

- 🥚 **이스터에그**: 위치 기반으로 메시지, 사진, 음악을 숨기고 친구들이 발견
- ⏰ **타임캡슐**: 여러 명이 함께 작성하고 특정 시점에 오픈
- 💳 **결제 시스템**: 카카오페이 및 토스페이먼츠 연동
- 👥 **소셜 로그인**: 카카오 OAuth 및 자체 회원가입 지원
- 📱 **푸시 알림**: Expo Push 알림 연동
- 📍 **위치 기반 검색**: PostGIS를 활용한 반경 검색

---

## 🛠 기술 스택

### Core
- **NestJS** v10.x - Node.js 백엔드 프레임워크
- **TypeScript** v5.x - 타입 안정성 보장
- **Node.js** v20.x - 런타임 환경

### Database & ORM
- **PostgreSQL** - 관계형 데이터베이스
- **TypeORM** v0.3.x - 엔티티 기반 ORM

### Authentication
- **Passport.js** - 인증 미들웨어
- **JWT** - Stateless 인증
- **Kakao OAuth 2.0** - 소셜 로그인
- **bcrypt** - 비밀번호 해싱

### Payment
- **카카오페이 API** - 모바일 결제
- **토스페이먼츠 API** - 통합 결제 솔루션

### Cloud & Storage
- **AWS S3** - 미디어 파일 저장

### Documentation & Validation
- **Swagger (OpenAPI 3.0)** - API 문서 자동 생성
- **class-validator** - DTO 기반 요청 검증
- **class-transformer** - 데이터 변환

---

## 📁 프로젝트 구조

```
src/
├── auth/                # 인증 모듈 (카카오 OAuth, JWT)
│   ├── strategies/      # Passport 전략
│   ├── guards/          # 인증 가드
│   └── decorators/      # 커스텀 데코레이터
├── capsules/            # 타임캡슐/이스터에그 모듈
│   ├── dto/             # 요청/응답 DTO
│   └── capsules-step-room.controller.ts  # Step Room (대기실)
├── orders/              # 주문 관리 모듈
├── payments/            # 결제 처리 모듈 (카카오페이, 토스)
├── media/               # 파일 업로드 모듈 (S3)
├── me/                  # 마이페이지 모듈
├── onboarding/          # 온보딩 모듈
├── entities/            # TypeORM 엔티티
├── database/            # DB 설정 및 마이그레이션
├── common/              # 공통 유틸리티
│   ├── constants/       # 상수 정의
│   ├── enums/           # Enum 정의
│   └── services/        # 공통 서비스
└── main.ts              # 애플리케이션 진입점
```

---

## 🚀 시작하기

### 사전 요구사항

- **Node.js** v20.x 이상
- **PostgreSQL** v14.x 이상
- **npm** v9.x 이상

### 설치

```bash
# 의존성 설치
npm install
```

### 환경 변수 설정

프로젝트 루트에 `.env` 파일을 생성하고 다음 내용을 설정하세요:

```bash
# Database
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=your-password
DATABASE_NAME=banny

# JWT
JWT_SECRET=your-jwt-secret-key
JWT_EXPIRES_IN=7d

# Kakao OAuth
KAKAO_CLIENT_ID=your-kakao-client-id
KAKAO_REDIRECT_URI=http://localhost:3000/api/auth/kakao/callback

# AWS S3
AWS_S3_BUCKET_NAME=your-bucket-name
AWS_REGION=ap-northeast-2
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key

# Payment Gateway
KAKAO_PAY_ADMIN_KEY=your-kakao-pay-admin-key
TOSS_SECRET_KEY=your-toss-secret-key

# Frontend URL (CORS)
FRONTEND_URL=http://localhost:8081
AUTH_CALLBACK_REDIRECT_URL=timeegg://auth/callback

# Server
PORT=3000
NODE_ENV=development
```

### 데이터베이스 마이그레이션

```bash
# 마이그레이션 실행
npm run migration:run

# 마이그레이션 되돌리기
npm run migration:revert
```

---

## 💻 실행

### 개발 모드

```bash
# watch mode (자동 재시작)
npm run start:dev
```

서버 실행 후 다음 주소로 접속:
- **API Server**: http://localhost:3000/api
- **Swagger Docs**: http://localhost:3000/api/docs

### 프로덕션 빌드

```bash
# 빌드
npm run build

# 프로덕션 실행
npm run start:prod
```

---

## 📚 API 문서

### Swagger UI

서버 실행 후 브라우저에서 다음 주소로 접속:

```
http://localhost:3000/api/docs
```

- 모든 API 엔드포인트 확인
- 요청/응답 스키마 확인
- 직접 API 테스트 가능

### 인증 설정

1. Swagger UI 우측 상단 **Authorize** 버튼 클릭
2. Bearer Token 입력:
   ```
   Bearer {your-jwt-token}
   ```
3. API 테스트

### API 설계 문서

상세한 API 설계 원칙 및 구조는 다음 문서를 참고하세요:

📄 [API 설계 문서](./docs/API-DESIGN.md)

---

## 🔑 주요 API 엔드포인트

### 인증 (Auth)
- `GET /api/auth/kakao` - 카카오 로그인
- `POST /api/auth/local/signup` - 자체 회원가입
- `POST /api/auth/local/login` - 자체 로그인
- `GET /api/auth/me` - 내 정보 조회
- `POST /api/auth/logout` - 로그아웃

### 이스터에그 (Capsules)
- `GET /api/capsules` - 위치 기반 캡슐 목록
- `POST /api/capsules` - 이스터에그 생성
- `GET /api/capsules/:id` - 캡슐 조회
- `POST /api/capsules/:id/viewers` - 발견 기록
- `GET /api/capsules/my-eggs` - 내 이스터에그 목록

### 타임캡슐 (Timecapsules)
- `GET /api/timecapsules/:id` - 타임캡슐 조회

### Step Room (대기실)
- `POST /api/step-rooms` - 대기실 생성
- `POST /api/step-rooms/:inviteCode/join` - 대기실 참여
- `POST /api/step-rooms/:inviteCode/slots/:slotIndex/save` - 콘텐츠 저장
- `POST /api/step-rooms/:inviteCode/submit` - 최종 제출

### 주문 (Orders)
- `POST /api/orders` - 주문 생성
- `GET /api/orders/:id` - 주문 조회
- `GET /api/orders/:orderId/status` - 주문 상태 조회

### 결제 (Payments)
- `POST /api/payments/kakao/ready` - 카카오페이 결제 준비
- `POST /api/payments/kakao/approve` - 카카오페이 결제 승인
- `POST /api/payments/toss/confirm` - 토스페이먼츠 결제 승인
- `GET /api/payments/toss/my-payments` - 내 결제 내역

### 미디어 (Media)
- `POST /api/media/upload` - 파일 직접 업로드
- `GET /api/media/:id/url` - 서명된 다운로드 URL

### 마이페이지 (Me)
- `GET /api/me` - 내 프로필 조회
- `POST /api/me/update` - 프로필 수정
- `POST /api/me/profile-image` - 프로필 이미지 업로드
- `GET /api/me/capsules` - 참여중인 캡슐 목록

전체 엔드포인트 목록은 [API 설계 문서](./docs/API-DESIGN.md)를 참고하세요.

---

## 🧪 테스트

```bash
# 단위 테스트
npm run test

# E2E 테스트
npm run test:e2e

# 테스트 커버리지
npm run test:cov

# Playwright E2E 테스트
npm run test:playwright
```

---

## 🔧 개발 도구

### 린트

```bash
# 린트 체크
npm run lint

# 린트 자동 수정
npm run lint:fix
```

### 포맷팅

```bash
# 코드 포맷팅
npm run format
```

---

## 🗄️ 데이터베이스

### 주요 엔티티

- **users** - 사용자 정보
- **capsules** - 타임캡슐/이스터에그
- **capsule_entries** - 타임캡슐 콘텐츠
- **capsule_participant_slots** - 타임캡슐 참여자 슬롯
- **products** - 상품 (유료/무료 아이템)
- **orders** - 주문
- **payments** - 결제
- **media** - 미디어 파일
- **capsule_access_logs** - 캡슐 조회 로그
- **friendships** - 친구 관계
- **notifications** - 알림

상세한 스키마는 [schema.sql](./schema.sql) 또는 [API 설계 문서](./docs/API-DESIGN.md)를 참고하세요.

---

## 🐳 Docker

### Docker Compose로 실행

```bash
# 컨테이너 빌드 및 실행
docker-compose up -d

# 로그 확인
docker-compose logs -f

# 컨테이너 중지
docker-compose down
```

---

## 📦 배포

### 프로덕션 체크리스트

- [ ] 환경 변수 설정 확인
- [ ] 데이터베이스 마이그레이션 실행
- [ ] JWT Secret 변경
- [ ] CORS 도메인 설정
- [ ] S3 버킷 권한 설정
- [ ] 결제 API 운영 키 설정
- [ ] 로그 모니터링 설정

### 빌드

```bash
npm run build
```

빌드된 파일은 `dist/` 디렉토리에 생성됩니다.

---

## 🤝 기여 가이드

### Git Commit Convention

Conventional Commits 방식을 사용합니다:

```bash
feat(scope): [날짜] 설명        # 새 기능
fix(scope): [날짜] 설명         # 버그 수정
docs: [날짜] 설명              # 문서 수정
chore: [날짜] 설명             # 기타 작업
refactor(scope): [날짜] 설명   # 리팩토링
test(scope): [날짜] 설명       # 테스트 추가/수정
```

예시:
```bash
git commit -m "feat(auth): [2026-01-13] 카카오 로그인 구현"
git commit -m "fix(capsules): [2026-01-13] 위치 검증 로직 수정"
```

---

## 📂 관련 문서

- 📄 [API 설계 문서](./docs/API-DESIGN.md) - API 설계 원칙 및 전체 구조
- 📊 [시퀀스 다이어그램](./시퀀스다이어그램.md) - 주요 플로우 다이어그램
- 🗃️ [데이터베이스 스키마](./schema.sql) - 전체 DB 스키마
- 📋 [Spec 문서](./specs/) - 기능별 상세 명세

---

## 🔒 보안

### 보안 이슈 보고

보안 취약점을 발견한 경우, 공개 이슈가 아닌 비공개 채널로 보고해 주세요.

### 주요 보안 기능

- JWT 토큰 기반 인증
- bcrypt 비밀번호 해싱 (salt rounds: 10)
- 토큰 버저닝 (강제 로그아웃)
- CORS 화이트리스트 관리
- DTO 기반 요청 검증
- S3 Presigned URL (시간 제한)

---

## 📄 라이선스

이 프로젝트는 MIT 라이선스를 따릅니다.

---

## 📞 문의

프로젝트에 대한 문의사항이 있으시면 이슈를 등록해 주세요.

---

## 🙏 기술 스택 크레딧

이 프로젝트는 다음 오픈소스 프로젝트를 사용합니다:

- [NestJS](https://nestjs.com/) - Progressive Node.js framework
- [TypeORM](https://typeorm.io/) - ORM for TypeScript and JavaScript
- [Passport](http://www.passportjs.org/) - Authentication middleware
- [Swagger](https://swagger.io/) - API documentation

---

<p align="center">
  Made with ❤️ by Banny-Banny Team
</p>
