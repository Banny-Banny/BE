# Banny-Banny API 설계 문서

> **작성일**: 2026-01-13  
> **프로젝트**: Banny-Banny 타임캡슐 서비스 백엔드  
> **버전**: 1.0

---

## 📋 목차

1. [프로젝트 개요](#프로젝트-개요)
2. [기술 스택](#기술-스택)
3. [아키텍처 설계](#아키텍처-설계)
4. [API 설계 원칙](#api-설계-원칙)
5. [모듈 구조](#모듈-구조)
6. [공통 패턴](#공통-패턴)
7. [API 엔드포인트](#api-엔드포인트)
8. [데이터베이스 설계](#데이터베이스-설계)
9. [보안 및 인증](#보안-및-인증)
10. [에러 핸들링](#에러-핸들링)
11. [파일 업로드 전략](#파일-업로드-전략)
12. [페이지네이션](#페이지네이션)

---

## 프로젝트 개요

**Banny-Banny**는 사용자들이 추억을 담은 타임캡슐을 생성하고, 위치 기반으로 이스터에그를 숨기며, 친구들과 공유할 수 있는 타임캡슐 서비스입니다.

### 주요 기능

- 🐰 **이스터에그**: 위치 기반으로 메시지, 사진, 음악을 숨기고 친구들이 발견
- ⏰ **타임캡슐**: 여러 명이 함께 작성하고 특정 시점에 오픈
- 💳 **결제 시스템**: 카카오페이 및 토스페이먼츠 연동
- 👥 **소셜 로그인**: 카카오 OAuth 및 자체 회원가입 지원
- 📱 **푸시 알림**: Expo Push 알림 연동

---

## 기술 스택

### Core Framework
- **NestJS** v10.x - 확장 가능하고 모듈화된 Node.js 백엔드 프레임워크
- **TypeScript** v5.x - 타입 안정성 및 개발 생산성 향상

### Database & ORM
- **PostgreSQL** - 관계형 데이터베이스
- **TypeORM** v0.3.x - 엔티티 기반 ORM, 마이그레이션 자동화

### Authentication & Authorization
- **Passport.js** - 인증 미들웨어
- **JWT** (JSON Web Token) - Stateless 인증
- **Kakao OAuth 2.0** - 소셜 로그인

### API Documentation
- **Swagger (OpenAPI 3.0)** - 자동화된 API 문서 생성

### Payment Gateway
- **카카오페이** - 모바일 결제
- **토스페이먼츠** - 통합 결제 솔루션

### File Storage
- **AWS S3** - 미디어 파일 저장 (이미지, 동영상, 음악)

### Validation & Security
- **class-validator** - DTO 기반 요청 검증
- **class-transformer** - 데이터 변환 자동화
- **CORS** - 크로스 도메인 요청 제어

---

## 아키텍처 설계

### 레이어 구조

```
┌─────────────────────────────────────────────┐
│           API Layer (Controllers)           │  ← HTTP 요청 처리, Swagger 문서화
├─────────────────────────────────────────────┤
│         Business Logic (Services)           │  ← 비즈니스 로직 구현
├─────────────────────────────────────────────┤
│      Data Access Layer (TypeORM Repos)      │  ← 데이터베이스 접근
├─────────────────────────────────────────────┤
│          Database (PostgreSQL)              │  ← 데이터 영속성
└─────────────────────────────────────────────┘
```

### 모듈 의존성

```
AppModule (Root)
├── ConfigModule (전역 환경 변수)
├── DatabaseModule (TypeORM)
├── AuthModule (인증/인가)
├── CapsulesModule (타임캡슐/이스터에그)
├── OrdersModule (주문 관리)
├── PaymentsModule (결제 처리)
├── MediaModule (파일 업로드)
├── MeModule (마이페이지)
└── OnboardingModule (온보딩)
```

---

## API 설계 원칙

### 1. **RESTful API 설계**

- 리소스 중심의 URL 설계
- HTTP 메서드 의미론 준수 (GET, POST, PUT, PATCH, DELETE)
- 상태 코드를 통한 명확한 응답

```typescript
// Good Examples
GET    /api/capsules          // 캡슐 목록 조회
POST   /api/capsules          // 캡슐 생성
GET    /api/capsules/:id      // 특정 캡슐 조회
POST   /api/capsules/:id/viewers  // 캡슐 발견 기록

GET    /api/orders/:id        // 주문 조회
POST   /api/orders            // 주문 생성
```

### 2. **API 버저닝**

- 현재는 URL prefix로 `/api` 사용
- 향후 버전 변경 시 `/api/v2` 형태로 확장 가능

```typescript
// main.ts
app.setGlobalPrefix('api');
```

### 3. **일관된 응답 구조**

모든 API는 다음과 같은 응답 구조를 따름:

```typescript
// 성공 응답
{
  "success": true,
  "data": { ... }
}

// 에러 응답
{
  "statusCode": 400,
  "message": "INVALID_CREDENTIALS",
  "error": "Bad Request"
}
```

### 4. **DTO (Data Transfer Object) 기반 검증**

- 모든 요청/응답은 DTO 클래스로 정의
- `class-validator`로 자동 검증
- Swagger 타입 안정성 보장

```typescript
// DTO 예시
export class CreateCapsuleDto {
  @IsString()
  @MaxLength(100)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  content?: string;

  @IsUUID()
  product_id: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;
}
```

### 5. **명확한 에러 코드 관리**

- Enum으로 에러 코드 중앙 관리
- 사용자 친화적 메시지 제공
- 프론트엔드에서 에러 타입별 처리 용이

```typescript
export enum ErrorCode {
  INVALID_TOKEN = 'INVALID_TOKEN',
  CAPSULE_NOT_FOUND = 'CAPSULE_NOT_FOUND',
  INSUFFICIENT_SLOTS = 'INSUFFICIENT_SLOTS',
  // ...
}
```

### 6. **인증/인가 분리**

- **Authentication**: JWT 토큰 기반 사용자 인증
- **Authorization**: Guard 패턴으로 리소스 접근 제어

```typescript
@UseGuards(JwtAuthGuard)  // 인증 필요
async getMyProfile(@CurrentUser() user: User) {
  // user.id로 소유권 검증 (인가)
}
```

---

## 모듈 구조

### 1. **AuthModule** - 인증 및 소셜로그인

**기능**:
- 카카오 OAuth 2.0 소셜 로그인
- 자체 회원가입/로그인 (전화번호/이메일 + 비밀번호)
- JWT 토큰 발급 및 검증
- 카카오 친구 목록 동기화

**엔드포인트**:
- `GET /api/auth/kakao` - 카카오 로그인 시작
- `GET /api/auth/kakao/callback` - 카카오 OAuth 콜백
- `POST /api/auth/local/signup` - 자체 회원가입
- `POST /api/auth/local/login` - 자체 로그인
- `POST /api/auth/logout` - 로그아웃 (토큰 무효화)
- `GET /api/auth/me` - 현재 사용자 정보 조회
- `GET /api/auth/verify` - 토큰 유효성 검증
- `POST /api/auth/kakao/friends-sync` - 카카오 친구 동기화

**핵심 전략**:
- Passport Kakao Strategy: OAuth2 인증 플로우
- JWT Strategy: Bearer 토큰 검증

---

### 2. **CapsulesModule** - 타임캡슐/이스터에그

**기능**:
- 이스터에그 생성/조회 (위치 기반)
- 타임캡슐 생성/조회 (그룹 참여)
- 캡슐 발견 기록 (조회 로그)
- 슬롯 관리 (생성 가능한 개수 제한)
- Step Room (타임캡슐 작성 대기실)

**엔드포인트**:

#### 이스터에그 (Capsules)
- `GET /api/capsules` - 위치 기반 캡슐 목록 (반경 검색)
- `POST /api/capsules` - 이스터에그 생성
- `GET /api/capsules/slots` - 남은 슬롯 조회
- `POST /api/capsules/slots/reset` - 슬롯 초기화
- `GET /api/capsules/my-eggs?type=PLANTED|FOUND` - 내 이스터에그 목록
- `GET /api/capsules/:id/detail` - 알 상세 정보
- `GET /api/capsules/:id` - 캡슐 조회
- `POST /api/capsules/:id/viewers` - 발견 기록
- `GET /api/capsules/:id/viewers` - 발견자 목록

#### 타임캡슐 (Timecapsules)
- `GET /api/timecapsules/:id` - 타임캡슐 조회 (참여자만)

#### Step Room (대기실)
- `POST /api/step-rooms` - 대기실 생성
- `GET /api/step-rooms/:inviteCode/details` - 대기실 정보 조회
- `POST /api/step-rooms/:inviteCode/join` - 대기실 참여
- `POST /api/step-rooms/:inviteCode/slots/:slotIndex/save` - 콘텐츠 저장
- `POST /api/step-rooms/:inviteCode/submit` - 최종 제출 (방장)

**핵심 로직**:
- **위치 기반 필터링**: PostGIS를 활용한 반경 검색
- **접근 제어**: 본인 캡슐은 언제든지 조회, 타인 캡슐은 300m 반경 + 친구 관계 필요
- **슬롯 제한**: 사용자당 이스터에그 3개 제한 (상품 구매로 확장 가능)

---

### 3. **OrdersModule** - 주문 관리

**기능**:
- 타임캡슐 상품 주문 생성
- 주문 상태 관리 (PENDING_PAYMENT → PAID → CANCELED)
- 주문 옵션 검증 (인원, 열람 시점, 미디어 개수 등)

**엔드포인트**:
- `POST /api/orders` - 주문 생성
- `GET /api/orders/:id` - 주문 상세 조회
- `GET /api/orders/:orderId/status` - 주문 상태 조회
- `POST /api/orders/:orderId/status` - 주문 상태 변경

**상태 전환 다이어그램**:
```
PENDING_PAYMENT (주문 생성)
    ↓
   PAID (결제 완료)
    ↓
  CANCELED (취소)
```

---

### 4. **PaymentsModule** - 결제 처리

**기능**:
- 카카오페이 결제 (모바일 중심)
- 토스페이먼츠 결제 (웹/카드 결제)
- 결제 내역 조회
- 결제 취소/환불

**엔드포인트**:

#### 카카오페이
- `POST /api/payments/kakao/ready` - 결제 준비
- `POST /api/payments/kakao/approve` - 결제 승인

#### 토스페이먼츠
- `POST /api/payments/toss/confirm` - 결제 승인
- `GET /api/payments/toss/my-payments` - 내 결제 내역
- `GET /api/payments/toss/orders/:orderNo` - 주문번호로 결제 조회
- `GET /api/payments/toss/:paymentKey` - paymentKey로 결제 조회
- `POST /api/payments/toss/:paymentKey/cancel` - 결제 취소

**결제 플로우**:
```
1. 주문 생성 (OrdersModule)
2. 결제 준비 (PaymentsModule - ready)
3. PG사 결제창 이동
4. 결제 승인 (PaymentsModule - approve/confirm)
5. 주문 상태 업데이트 (PAID)
6. 캡슐 생성 가능
```

---

### 5. **MediaModule** - 파일 업로드

**기능**:
- 이미지, 동영상, 음악 파일 업로드
- AWS S3 연동
- Presigned URL 발급 (안전한 파일 다운로드)

**엔드포인트**:
- `POST /api/media/upload` - 파일 직접 업로드 (권장)
- `POST /api/media/presign` - Presigned URL 발급 (레거시)
- `POST /api/media/complete` - 업로드 완료 확인
- `GET /api/media/:id/url` - 서명된 다운로드 URL 조회

**파일 저장 구조**:
```
s3://bucket-name/
  media/
    {user-id}/
      IMAGE/
        {uuid}.jpg
        {uuid}.png
      VIDEO/
        {uuid}.mp4
      AUDIO/
        {uuid}.mp3
```

**제한**:
- 이미지: 최대 5MB (프로필 이미지)
- 미디어: 최대 200MB (동영상/음악)

---

### 6. **MeModule** - 마이페이지

**기능**:
- 프로필 조회/수정
- 알림 설정 관리
- 참여중인 타임캡슐 목록
- 프로필 이미지 업로드
- 푸시 토큰 등록

**엔드포인트**:
- `GET /api/me` - 내 프로필 조회
- `POST /api/me/update` - 프로필 수정
- `POST /api/me/settings` - 알림 설정 수정
- `POST /api/me/push-token` - 푸시 토큰 등록
- `POST /api/me/profile-image` - 프로필 이미지 업로드
- `GET /api/me/capsules` - 참여중인 타임캡슐 목록

---

### 7. **OnboardingModule** - 온보딩

**기능**:
- 신규 사용자 온보딩 플로우
- 친구 동의, 위치 동의 저장

**엔드포인트**:
- `POST /api/onboarding/complete` - 온보딩 완료

---

## 공통 패턴

### 1. **Controller 패턴**

모든 컨트롤러는 다음 구조를 따름:

```typescript
@ApiTags('모듈명')
@ApiBearerAuth('access-token')
@Controller('resource')
export class ResourceController {
  constructor(private readonly service: ResourceService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '설명' })
  @ApiResponse({ status: 200, description: '성공' })
  async findAll(@CurrentUser() user: User) {
    return this.service.findAll(user);
  }
}
```

### 2. **Service 패턴**

비즈니스 로직은 Service 레이어에 집중:

```typescript
@Injectable()
export class ResourceService {
  constructor(
    @InjectRepository(Entity)
    private readonly repo: Repository<Entity>,
  ) {}

  async findAll(user: User) {
    // 비즈니스 로직
    return this.repo.find({ where: { userId: user.id } });
  }
}
```

### 3. **Guard 패턴**

인증/인가는 Guard로 처리:

```typescript
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }
}
```

### 4. **Decorator 패턴**

커스텀 데코레이터로 코드 간결화:

```typescript
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);

// 사용
@Get('profile')
async getProfile(@CurrentUser() user: User) {
  // user 객체 직접 사용
}
```

---

## API 엔드포인트

### 전역 설정

- **Base URL**: `http://localhost:3000/api`
- **Swagger Docs**: `http://localhost:3000/api/docs`
- **인증**: Bearer Token (JWT)

### 엔드포인트 목록

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| **Health Check** ||||
| GET | `/api/health` | 서버 상태 확인 | ❌ |
| **Auth** ||||
| GET | `/api/auth/kakao` | 카카오 로그인 시작 | ❌ |
| POST | `/api/auth/local/signup` | 자체 회원가입 | ❌ |
| POST | `/api/auth/local/login` | 자체 로그인 | ❌ |
| POST | `/api/auth/logout` | 로그아웃 | ✅ |
| GET | `/api/auth/me` | 내 정보 조회 | ✅ |
| GET | `/api/auth/verify` | 토큰 검증 | ✅ |
| POST | `/api/auth/kakao/friends-sync` | 카카오 친구 동기화 | ✅ |
| **Capsules** ||||
| GET | `/api/capsules` | 위치 기반 캡슐 목록 | ✅ |
| POST | `/api/capsules` | 이스터에그 생성 | ✅ |
| GET | `/api/capsules/slots` | 남은 슬롯 조회 | ✅ |
| POST | `/api/capsules/slots/reset` | 슬롯 초기화 | ✅ |
| GET | `/api/capsules/my-eggs` | 내 이스터에그 목록 | ✅ |
| GET | `/api/capsules/:id` | 캡슐 조회 | ✅ |
| GET | `/api/capsules/:id/detail` | 알 상세 정보 | ✅ |
| POST | `/api/capsules/:id/viewers` | 발견 기록 | ✅ |
| GET | `/api/capsules/:id/viewers` | 발견자 목록 | ✅ |
| **Timecapsules** ||||
| GET | `/api/timecapsules/:id` | 타임캡슐 조회 | ✅ |
| **Step Rooms** ||||
| POST | `/api/step-rooms` | 대기실 생성 | ✅ |
| GET | `/api/step-rooms/:inviteCode/details` | 대기실 정보 | ✅ |
| POST | `/api/step-rooms/:inviteCode/join` | 대기실 참여 | ✅ |
| POST | `/api/step-rooms/:inviteCode/slots/:slotIndex/save` | 콘텐츠 저장 | ✅ |
| POST | `/api/step-rooms/:inviteCode/submit` | 최종 제출 | ✅ |
| **Orders** ||||
| POST | `/api/orders` | 주문 생성 | ✅ |
| GET | `/api/orders/:id` | 주문 조회 | ✅ |
| GET | `/api/orders/:orderId/status` | 주문 상태 조회 | ✅ |
| POST | `/api/orders/:orderId/status` | 주문 상태 변경 | ✅ |
| **Payments (Kakao)** ||||
| POST | `/api/payments/kakao/ready` | 결제 준비 | ✅ |
| POST | `/api/payments/kakao/approve` | 결제 승인 | ✅ |
| **Payments (Toss)** ||||
| POST | `/api/payments/toss/confirm` | 결제 승인 | ✅ |
| GET | `/api/payments/toss/my-payments` | 내 결제 내역 | ✅ |
| GET | `/api/payments/toss/orders/:orderNo` | 주문번호로 조회 | ✅ |
| GET | `/api/payments/toss/:paymentKey` | paymentKey로 조회 | ✅ |
| POST | `/api/payments/toss/:paymentKey/cancel` | 결제 취소 | ✅ |
| **Media** ||||
| POST | `/api/media/upload` | 파일 직접 업로드 | ✅ |
| POST | `/api/media/presign` | Presigned URL 발급 | ✅ |
| POST | `/api/media/complete` | 업로드 완료 | ✅ |
| GET | `/api/media/:id/url` | 서명된 URL 조회 | ✅ |
| **Me (마이페이지)** ||||
| GET | `/api/me` | 내 프로필 조회 | ✅ |
| POST | `/api/me/update` | 프로필 수정 | ✅ |
| POST | `/api/me/settings` | 알림 설정 수정 | ✅ |
| POST | `/api/me/push-token` | 푸시 토큰 등록 | ✅ |
| POST | `/api/me/profile-image` | 프로필 이미지 업로드 | ✅ |
| GET | `/api/me/capsules` | 참여중인 캡슐 목록 | ✅ |
| **Onboarding** ||||
| POST | `/api/onboarding/complete` | 온보딩 완료 | ✅ |

---

## 데이터베이스 설계

### 주요 엔티티

#### 1. **users** - 사용자

```sql
- id (UUID, PK)
- kakao_id (VARCHAR, UNIQUE)
- phone_number (VARCHAR, UNIQUE)
- email (VARCHAR, UNIQUE)
- nickname (VARCHAR, NOT NULL)
- profile_img (VARCHAR)
- egg_slots (INTEGER, DEFAULT 3)
- friend_consent (BOOLEAN)
- location_consent (BOOLEAN)
- push_notification (BOOLEAN)
- marketing_notification (BOOLEAN)
- is_active (BOOLEAN, DEFAULT true)
- token_version (INTEGER, DEFAULT 0)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

#### 2. **capsules** - 타임캡슐/이스터에그

```sql
- id (UUID, PK)
- user_id (UUID, FK → users)
- product_id (UUID, FK → products, NULLABLE)
- order_id (UUID, FK → orders, NULLABLE)
- title (VARCHAR(100))
- content (TEXT)
- latitude (DECIMAL, NULLABLE)
- longitude (DECIMAL, NULLABLE)
- open_at (TIMESTAMP, NOT NULL)
- is_locked (BOOLEAN)
- view_limit (INTEGER)
- view_count (INTEGER, DEFAULT 0)
- is_deleted (BOOLEAN, DEFAULT false)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
- deleted_at (TIMESTAMP)
```

#### 3. **capsule_entries** - 타임캡슐 콘텐츠

```sql
- id (UUID, PK)
- capsule_id (UUID, FK → capsules)
- slot_id (UUID, FK → capsule_participant_slots)
- content (TEXT)
- wrote_at (TIMESTAMP)
- created_at (TIMESTAMP)
```

#### 4. **capsule_participant_slots** - 타임캡슐 참여자 슬롯

```sql
- id (UUID, PK)
- capsule_id (UUID, FK → capsules)
- user_id (UUID, FK → users, NULLABLE)
- slot_index (INTEGER, NOT NULL)
- invite_code (VARCHAR, UNIQUE, NULLABLE)
- room_status (ENUM, DEFAULT 'WAITING')
- created_at (TIMESTAMP)
```

#### 5. **products** - 상품

```sql
- id (UUID, PK)
- product_type (ENUM: EASTER_EGG, TIME_CAPSULE)
- name (VARCHAR, NOT NULL)
- description (TEXT)
- price (INTEGER, NOT NULL)
- max_media_count (INTEGER)
- media_types (VARCHAR[])
- is_active (BOOLEAN)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

#### 6. **orders** - 주문

```sql
- id (UUID, PK)
- user_id (UUID, FK → users)
- product_id (UUID, FK → products)
- status (ENUM, DEFAULT PENDING_PAYMENT)
- total_amount (INTEGER, NOT NULL)
- time_option (ENUM)
- custom_open_at (TIMESTAMP)
- headcount (INTEGER)
- photo_count (INTEGER)
- add_music (BOOLEAN)
- add_video (BOOLEAN)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

#### 7. **payments** - 결제

```sql
- id (UUID, PK)
- order_id (UUID, FK → orders)
- user_id (UUID, FK → users)
- pg_provider (VARCHAR: kakao, toss)
- payment_key (VARCHAR, UNIQUE)
- tid (VARCHAR)
- status (ENUM)
- method (VARCHAR)
- card_type (VARCHAR)
- amount (INTEGER)
- approved_at (TIMESTAMP)
- receipt_url (VARCHAR)
- pg_raw_response (JSONB)
- created_at (TIMESTAMP)
```

#### 8. **media** - 미디어 파일

```sql
- id (UUID, PK)
- user_id (UUID, FK → users)
- type (ENUM: IMAGE, VIDEO, AUDIO)
- object_key (VARCHAR, NOT NULL)
- size (INTEGER)
- content_type (VARCHAR)
- created_at (TIMESTAMP)
```

#### 9. **capsule_access_logs** - 캡슐 조회 로그

```sql
- id (UUID, PK)
- capsule_id (UUID, FK → capsules)
- user_id (UUID, FK → users)
- latitude (DECIMAL)
- longitude (DECIMAL)
- accessed_at (TIMESTAMP)
```

#### 10. **friendships** - 친구 관계

```sql
- id (UUID, PK)
- user_id (UUID, FK → users)
- friend_id (UUID, FK → users)
- status (ENUM: PENDING, CONNECTED, BLOCKED)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

---

## 보안 및 인증

### 1. **JWT 토큰 기반 인증**

**토큰 구조**:
```json
{
  "sub": "user-uuid",
  "iat": 1704067200,
  "exp": 1704153600
}
```

**발급 시점**:
- 카카오 로그인 성공 시
- 자체 로그인 성공 시

**검증**:
- `JwtAuthGuard`로 모든 보호된 엔드포인트에서 자동 검증
- 만료된 토큰은 401 Unauthorized 반환

**토큰 무효화**:
- `token_version` 필드로 로그아웃 시 강제 만료
- 로그아웃 시 `token_version++` → 기존 토큰 무효화

### 2. **비밀번호 보안**

- **bcrypt** 해싱 (salt rounds: 10)
- 평문 비밀번호는 절대 저장하지 않음

```typescript
const hashedPassword = await bcrypt.hash(plainPassword, 10);
const isValid = await bcrypt.compare(plainPassword, hashedPassword);
```

### 3. **CORS 설정**

```typescript
app.enableCors({
  origin: ['http://localhost:8081', 'exp://192.168.*.*:8081'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});
```

### 4. **요청 검증 (Validation Pipeline)**

```typescript
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true, // DTO에 없는 필드 제거
    transform: true, // 자동 타입 변환
    transformOptions: {
      enableImplicitConversion: true,
    },
  }),
);
```

---

## 에러 핸들링

### 에러 코드 관리

모든 에러는 `ErrorCode` Enum으로 중앙 관리:

```typescript
export enum ErrorCode {
  // 인증
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  
  // 캡슐
  CAPSULE_NOT_FOUND = 'CAPSULE_NOT_FOUND',
  INSUFFICIENT_SLOTS = 'INSUFFICIENT_SLOTS',
  LOCATION_TOO_FAR = 'LOCATION_TOO_FAR',
  
  // 결제
  PAYMENT_AMOUNT_MISMATCH = 'PAYMENT_AMOUNT_MISMATCH',
  PAYMENT_ALREADY_APPROVED = 'PAYMENT_ALREADY_APPROVED',
  
  // ...
}
```

### HTTP 상태 코드

| 상태 코드 | 설명 |
|----------|------|
| 200 OK | 성공 |
| 201 Created | 리소스 생성 성공 |
| 400 Bad Request | 잘못된 요청 (검증 실패) |
| 401 Unauthorized | 인증 실패 (토큰 없음/만료) |
| 403 Forbidden | 인가 실패 (권한 없음) |
| 404 Not Found | 리소스 미존재 |
| 409 Conflict | 리소스 충돌 (중복 등) |
| 500 Internal Server Error | 서버 내부 오류 |

### 에러 응답 형식

```json
{
  "statusCode": 403,
  "message": "LOCATION_TOO_FAR",
  "error": "Forbidden"
}
```

---

## 파일 업로드 전략

### 1. **직접 업로드 방식 (권장)**

```typescript
POST /api/media/upload
Content-Type: multipart/form-data

{
  file: (binary),
  type: "IMAGE" | "VIDEO" | "AUDIO"
}
```

**장점**:
- 간단한 구현
- 즉시 업로드 결과 확인

**제한**:
- 이미지: 최대 5MB (프로필)
- 미디어: 최대 200MB (캡슐 콘텐츠)

### 2. **Presigned URL 방식 (레거시)**

```
1. POST /api/media/presign → presignedUrl 발급
2. PUT presignedUrl (S3에 직접 업로드)
3. POST /api/media/complete → 완료 확인
```

**장점**:
- 서버 부하 감소
- 대용량 파일 업로드 안정성

---

## 페이지네이션

### 1. **Offset-based Pagination (마이페이지)**

```typescript
GET /api/me/capsules?limit=20&offset=0

Response:
{
  "items": [...],
  "total": 45,
  "limit": 20,
  "offset": 0
}
```

### 2. **Cursor-based Pagination (캡슐 목록)**

```typescript
GET /api/capsules?lat=37.5&lng=127.0&limit=50&cursor=base64...

Response:
{
  "items": [...],
  "page_info": {
    "next_cursor": "base64EncodedCursor"
  }
}
```

**장점**:
- 실시간 데이터 변경에도 안정적
- 중복/누락 방지

---

## Swagger 문서

### 접속

```
http://localhost:3000/api/docs
```

### 인증 설정

1. Swagger UI 우측 상단 **Authorize** 버튼 클릭
2. Bearer Token 입력:
   ```
   Bearer {your-jwt-token}
   ```
3. API 테스트 가능

### 태그 구조

- **Health**: 서버 상태
- **Auth**: 인증/로그인
- **Capsules**: 이스터에그
- **Timecapsules**: 타임캡슐
- **Orders**: 주문
- **Payments**: 결제
- **Media**: 파일 업로드
- **Me (마이페이지)**: 프로필/설정
- **온보딩**: 신규 사용자

---

## 개발 환경 설정

### 환경 변수 (.env)

```bash
# Database
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=password
DATABASE_NAME=banny

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d

# Kakao OAuth
KAKAO_CLIENT_ID=your-kakao-client-id
KAKAO_REDIRECT_URI=http://localhost:3000/api/auth/kakao/callback

# AWS S3
AWS_S3_BUCKET_NAME=your-bucket
AWS_REGION=ap-northeast-2
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key

# Payment Gateway
KAKAO_PAY_ADMIN_KEY=your-admin-key
TOSS_SECRET_KEY=your-toss-secret-key

# Server
PORT=3000
NODE_ENV=development
```

### 로컬 실행

```bash
# 개발 모드
npm run start:dev

# 빌드
npm run build

# 프로덕션 모드
npm run start:prod
```

---

## 배포 및 CI/CD

### Docker 지원

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

### Health Check

```bash
GET /api/health

Response:
{
  "status": "ok",
  "timestamp": "2026-01-13T10:00:00.000Z"
}
```

---

## 향후 개선 사항

### 1. **API 버저닝**
- `/api/v2`로 버전 관리

### 2. **Rate Limiting**
- 과도한 요청 방지

### 3. **캐싱**
- Redis 연동으로 조회 성능 향상

### 4. **로깅**
- Winston/Pino로 구조화된 로그

### 5. **모니터링**
- Sentry 에러 트래킹
- Prometheus + Grafana 메트릭

---

## 참고 자료

- [NestJS 공식 문서](https://docs.nestjs.com)
- [TypeORM 공식 문서](https://typeorm.io)
- [Swagger/OpenAPI 3.0](https://swagger.io/specification/)
- [카카오페이 API 문서](https://developers.kakaopay.com)
- [토스페이먼츠 API 문서](https://docs.tosspayments.com)

---

**문서 작성자**: AI Assistant  
**최종 수정일**: 2026-01-13  
**프로젝트 저장소**: `/Users/kimdongeun/Desktop/Banny-Banny/BE`
