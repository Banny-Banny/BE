# 기능 명세서: 남은 이스터에그 슬롯 조회 API

## 1. 개요

### 목적
사용자가 현재 생성할 수 있는 남은 이스터에그(캡슐)의 개수를 조회하여 화면에 표시하기 위한 API

### 대상 사용자
- 이스터에그 작성 페이지를 보는 사용자
- 마이페이지에서 슬롯 현황을 확인하는 사용자

### 주요 가치
- 사용자가 생성 가능한 캡슐 개수를 사전에 파악
- 슬롯 소진 전 구매 유도 가능
- 명확한 사용 현황 제공으로 UX 개선

---

## 2. API 상세 스펙

### 2.1 기본 정보

| 항목 | 내용 |
|------|------|
| **HTTP Method** | `GET` |
| **Endpoint** | `/api/capsule/slots` |
| **Authentication** | 필수 (JWT Bearer Token) |
| **Controller** | `CapsulesController` |
| **Service Method** | `getCapsuleSlots()` |

### 2.2 Request

#### Headers
```http
Authorization: Bearer {access_token}
```

#### Parameters
없음 (현재 로그인한 사용자 기준)

### 2.3 Response

#### Success Response (200 OK)

```typescript
{
  "totalSlots": 10,      // 사용자의 전체 슬롯 개수
  "usedSlots": 5,        // 현재 사용 중인 슬롯 개수
  "remainingSlots": 5    // 남은 슬롯 개수
}
```

**응답 필드 설명**

| 필드 | 타입 | 설명 |
|------|------|------|
| `totalSlots` | `number` | 사용자가 보유한 전체 슬롯 수 (기본 10개 + 추가 구매분) |
| `usedSlots` | `number` | 현재 생성된 캡슐 개수 (active 상태) |
| `remainingSlots` | `number` | 생성 가능한 남은 슬롯 수 (totalSlots - usedSlots) |

#### Error Responses

| 상태 코드 | 설명 | 응답 예시 |
|----------|------|----------|
| **401 Unauthorized** | 인증 토큰 누락 또는 유효하지 않음 | `{ "statusCode": 401, "message": "Unauthorized" }` |
| **500 Internal Server Error** | 서버 내부 오류 | `{ "statusCode": 500, "message": "Internal server error" }` |

---

## 3. 비즈니스 로직

### 3.1 슬롯 계산 로직

```
remainingSlots = totalSlots - usedSlots
```

**세부 계산 방식:**

1. **totalSlots (전체 슬롯)**
   - `users` 테이블의 `capsule_slot_count` 컬럼에서 조회
   - 기본값: 3개
   - 향후 결제/이벤트로 증가 가능

2. **usedSlots (사용 중인 슬롯)**
   - `capsules` 테이블에서 해당 사용자가 생성한 캡슐 개수 카운트
   - 조건: `user_id = 현재사용자 AND deleted_at IS NULL`
   - 상태 무관 (모든 상태의 캡슐 포함)

3. **remainingSlots (남은 슬롯)**
   - 위 두 값의 차이로 계산
   - 최소값: 0 (음수 불가)

### 3.2 데이터베이스 스키마 참고

#### users 테이블
```sql
capsule_slot_count INT DEFAULT 3 NOT NULL
```

#### capsules 테이블
```sql
SELECT COUNT(*) 
FROM capsules 
WHERE user_id = ? AND deleted_at IS NULL
```

---

## 4. 기술 요구사항

### 4.1 사용 기술
- **Framework**: NestJS
- **ORM**: TypeORM
- **Authentication**: JWT Guard
- **Documentation**: Swagger

### 4.2 구현 위치
- **Controller**: `src/capsules/capsules.controller.ts`
- **Service**: `src/capsules/capsules.service.ts`
- **DTO**: `src/capsules/dto/get-capsule-slots.dto.ts`

### 4.3 보안
- JWT 인증 필수 (`@UseGuards(JwtAuthGuard)`)
- 요청자 본인의 정보만 조회 가능 (`@GetUser()` 데코레이터 사용)

---

## 5. 확장성 고려사항

### 5.1 향후 확장 가능성

1. **슬롯 증가 방식**
   - 유료 상품 구매를 통한 슬롯 추가
   - 이벤트를 통한 임시 슬롯 제공
   - 친구 초대 보상

2. **슬롯 타입 분리**
   - 무료 슬롯 / 유료 슬롯 구분
   - 일반 슬롯 / 프리미엄 슬롯 구분

3. **슬롯 만료 정책**
   - 구매한 슬롯의 유효기간 관리
   - 임시 이벤트 슬롯의 만료

### 5.2 성능 최적화
- 자주 호출될 수 있는 API이므로 DB 쿼리 최적화 필요
- 캡슐 개수 카운트 쿼리 인덱스 활용
- 필요시 캐싱 고려 (Redis)

---

## 6. 테스트 시나리오

### 6.1 정상 케이스

| 시나리오 | 조건 | 예상 결과 |
|---------|------|----------|
| 슬롯 미사용 | totalSlots: , 생성된 캡슐: 0 | `{ totalSlots: 10, usedSlots: 0, remainingSlots: 10 }` |
| 슬롯 일부 사용 | totalSlots: 10, 생성된 캡슐: 5 | `{ totalSlots: 10, usedSlots: 5, remainingSlots: 5 }` |
| 슬롯 전체 사용 | totalSlots: 10, 생성된 캡슐: 10 | `{ totalSlots: 10, usedSlots: 10, remainingSlots: 0 }` |
| 추가 슬롯 보유 | totalSlots: 15, 생성된 캡슐: 8 | `{ totalSlots: 15, usedSlots: 8, remainingSlots: 7 }` |

### 6.2 예외 케이스

| 시나리오 | 조건 | 예상 결과 |
|---------|------|----------|
| 인증 토큰 없음 | Authorization 헤더 누락 | 401 Unauthorized |
| 유효하지 않은 토큰 | 만료되거나 잘못된 토큰 | 401 Unauthorized |
| 사용자 정보 없음 | DB에 사용자가 존재하지 않음 | 404 Not Found |

---

## 7. Swagger 문서화

### 7.1 API 문서 예시

```typescript
@ApiOperation({ 
  summary: '남은 캡슐 슬롯 조회', 
  description: '현재 사용자가 생성 가능한 남은 캡슐 개수 조회' 
})
@ApiResponse({ 
  status: 200, 
  description: '슬롯 정보 조회 성공',
  type: GetCapsuleSlotsResponseDto
})
@ApiResponse({ 
  status: 401, 
  description: '인증 실패' 
})
@ApiBearerAuth()
```

---

## 8. 프론트엔드 연동 가이드

### 8.1 API 호출 예시

```typescript
// React/TypeScript 예시
const fetchCapsuleSlots = async () => {
  const response = await fetch('/api/capsule/slots', {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });
  
  const data = await response.json();
  // data: { totalSlots: 10, usedSlots: 5, remainingSlots: 5 }
  
  return data;
};
```

### 8.2 UI 표시 예시

```tsx
{remainingSlots > 0 ? (
  <p>남은 이스터에그: {remainingSlots}개</p>
) : (
  <p>슬롯이 모두 사용되었습니다. 추가 구매가 필요합니다.</p>
)}
```

---

## 9. 구현 체크리스트

- [ ] DTO 작성 (`GetCapsuleSlotsResponseDto`)
- [ ] Service 메서드 구현 (`getCapsuleSlots()`)
- [ ] Controller 엔드포인트 추가 (`GET /api/capsule/slots`)
- [ ] JWT Guard 적용
- [ ] Swagger 문서화
- [ ] 단위 테스트 작성
- [ ] E2E 테스트 작성
- [ ] 로컬 환경 테스트
- [ ] API 문서 확인

---

## 10. 참고 자료

### 관련 엔티티
- `User` (`src/entities/user.entity.ts`)
- `Capsule` (`src/entities/capsule.entity.ts`)

### 관련 API
- `POST /api/capsule` - 캡슐 생성 (슬롯 소비)
- `GET /api/capsule` - 캡슐 목록 조회

### 유사 기능
- 현재 프로젝트에는 유사 기능 없음 (신규 기능)

