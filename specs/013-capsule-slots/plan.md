# Implementation Plan: 남은 이스터에그 슬롯 조회 API

**Branch**: `013-capsule-slots` | **Date**: 2025-12-31 | **Spec**: `specs/013-capsule-slots/spec.md`  
**Input**: 사용자가 생성 가능한 남은 캡슐(이스터에그) 슬롯 개수를 조회하는 간단한 GET API

---

## Summary

- **목적**: 사용자의 전체 슬롯 수(`egg_slots`)에서 현재 생성된 캡슐 개수를 차감하여 남은 슬롯 개수를 반환
- **엔드포인트**: `GET /api/capsule/slots`
- **인증**: JWT 필수
- **응답**: `{ totalSlots, usedSlots, remainingSlots }` (모두 number 타입)
- **비즈니스 로직**: `remainingSlots = totalSlots - usedSlots`
  - `totalSlots`: `users.egg_slots` 컬럼 값
  - `usedSlots`: 해당 사용자가 생성한 캡슐 개수 (`capsules` 테이블에서 `deleted_at IS NULL` 조건으로 카운트)

---

## Technical Context

### 기술 스택
- **Framework**: NestJS + TypeORM + PostgreSQL
- **인증**: JWT Bearer Token (`JwtAuthGuard`)
- **문서화**: Swagger (`@ApiOperation`, `@ApiBearerAuth`)

### 관련 모듈 및 엔티티
- **Module**: `CapsulesModule`
- **Controller**: `CapsulesController` (`src/capsules/capsules.controller.ts`)
- **Service**: `CapsulesService` (`src/capsules/capsules.service.ts`)
- **Entities**:
  - `User` (`src/entities/user.entity.ts`) - `egg_slots` 컬럼 보유
  - `Capsule` (`src/entities/capsule.entity.ts`) - 캡슐 개수 카운트

### 데이터베이스 스키마

#### users 테이블
```sql
egg_slots INT DEFAULT 3 NOT NULL
  COMMENT '사용자가 보유한 이스터에그 작성 가능 슬롯 (기본 3, 생성 시 1 소모)'
```

#### capsules 테이블
```sql
SELECT COUNT(*) 
FROM capsules 
WHERE user_id = ? AND deleted_at IS NULL
```

---

## Plan / Steps

### 1. DTO 작성
- **파일**: `src/capsules/dto/get-capsule-slots.dto.ts`
- **내용**:
  ```typescript
  // Response DTO
  export class GetCapsuleSlotsResponseDto {
    totalSlots: number;
    usedSlots: number;
    remainingSlots: number;
  }
  ```
- **Swagger 데코레이터**: `@ApiProperty()` 추가하여 각 필드 문서화

### 2. Service 메서드 구현
- **파일**: `src/capsules/capsules.service.ts`
- **메서드**: `async getCapsuleSlots(userId: string): Promise<GetCapsuleSlotsResponseDto>`
- **로직**:
  1. `userRepository.findOne({ where: { id: userId } })` 로 사용자 조회
     - 사용자 없으면 `404 NotFoundException` 발생
  2. `totalSlots = user.eggSlots` 가져오기
  3. `capsuleRepository.count({ where: { userId, deletedAt: IsNull() } })` 로 생성된 캡슐 개수 카운트
  4. `usedSlots = 캡슐 개수`
  5. `remainingSlots = Math.max(0, totalSlots - usedSlots)` 계산 (음수 방지)
  6. 결과 반환

### 3. Controller 엔드포인트 추가
- **파일**: `src/capsules/capsules.controller.ts`
- **메서드**: `getCapsuleSlots(@GetUser() user)`
- **라우트**: `@Get('slots')`
- **가드**: `@UseGuards(JwtAuthGuard)`
- **Swagger**:
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
  @ApiResponse({ status: 401, description: '인증 실패' })
  @ApiBearerAuth()
  ```

### 4. Module에 Repository 주입 확인
- **파일**: `src/capsules/capsules.module.ts`
- `TypeOrmModule.forFeature([Capsule, User])` 이미 등록되어 있는지 확인
- `CapsulesService`에서 `UserRepository` 주입 필요

### 5. Swagger 문서화
- DTO에 `@ApiProperty()` 데코레이터 추가
- Controller에 `@ApiOperation()`, `@ApiResponse()`, `@ApiBearerAuth()` 추가
- 응답 예시 및 에러 케이스 문서화

### 6. 테스트 작성
- **단위 테스트** (`capsules.service.spec.ts`):
  - 정상 케이스: 슬롯 10개, 사용 5개 → 남은 슬롯 5개
  - 엣지 케이스: 슬롯 전체 소진 (10/10 → 0)
  - 엣지 케이스: 캡슐 미생성 (10/0 → 10)
  - 예외 케이스: 사용자 없음 → 404
- **E2E 테스트** (`tests/playwright/capsule-slots.spec.ts`):
  - JWT 토큰 없이 요청 → 401
  - 유효한 토큰으로 요청 → 200 + 올바른 데이터 구조

### 7. 로컬 테스트
- 개발 서버 실행: `npm run start:dev`
- Swagger UI 접속: `http://localhost:3000/api/docs`
- `/api/capsule/slots` 엔드포인트 테스트
- 응답 데이터 확인

---

## Scope / Out of Scope

### 포함 (In Scope)
✅ 남은 슬롯 개수 조회 API  
✅ JWT 인증 적용  
✅ Swagger 문서화  
✅ 단위/E2E 테스트  

### 제외 (Out of Scope)
❌ 슬롯 증가/구매 로직 (별도 기능)  
❌ 슬롯 만료 정책  
❌ 슬롯 타입 구분 (무료/유료)  
❌ 실시간 알림/푸시  
❌ 관리자 슬롯 조정 API  

---

## Risks / Checks

### 1. 데이터 정합성 이슈
- **리스크**: `users.egg_slots`와 실제 생성된 캡슐 개수가 불일치할 수 있음
- **대응**: 
  - 캡슐 생성 시 슬롯 검증 로직 추가 필요 (별도 이슈)
  - 현재는 단순 계산만 수행 (음수 방지만 적용)

### 2. 성능 고려
- **리스크**: 자주 호출될 수 있는 API
- **대응**:
  - 현재는 간단한 `COUNT` 쿼리이므로 성능 문제 없음
  - 향후 필요시 Redis 캐싱 고려
  - `user_id` 인덱스는 이미 FK로 존재

### 3. 음수 값 방지
- **리스크**: DB 데이터 오류로 `usedSlots > totalSlots` 상황 발생 가능
- **대응**: `Math.max(0, totalSlots - usedSlots)` 로 음수 방지

### 4. Soft Delete 처리
- **리스크**: `deleted_at`이 NULL인 캡슐만 카운트해야 함
- **대응**: `deletedAt: IsNull()` 조건 필수 적용

---

## Implementation Details

### API Flow

```
1. Client → GET /api/capsule/slots (with JWT)
2. JwtAuthGuard → 토큰 검증 및 user 추출
3. CapsulesController.getCapsuleSlots(user)
4. CapsulesService.getCapsuleSlots(user.id)
   4-1. User 조회 (egg_slots 값)
   4-2. Capsule COUNT (deleted_at IS NULL)
   4-3. remainingSlots 계산
5. Response → { totalSlots, usedSlots, remainingSlots }
```

### Database Queries

```sql
-- 1. 사용자 슬롯 수 조회
SELECT egg_slots FROM users WHERE id = ? AND deleted_at IS NULL;

-- 2. 생성된 캡슐 개수 카운트
SELECT COUNT(*) FROM capsules 
WHERE user_id = ? AND deleted_at IS NULL;
```

### Error Handling

| 상황 | HTTP 상태 | 메시지 |
|------|----------|--------|
| 인증 토큰 없음 | 401 | Unauthorized |
| 유효하지 않은 토큰 | 401 | Unauthorized |
| 사용자 없음 | 404 | User not found |
| 서버 오류 | 500 | Internal server error |

---

## Dependencies

### 필요한 Import
```typescript
// Service
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { User } from '../entities/user.entity';
import { Capsule } from '../entities/capsule.entity';

// Controller
import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
```

### Module Configuration
```typescript
@Module({
  imports: [TypeOrmModule.forFeature([Capsule, User])],
  controllers: [CapsulesController],
  providers: [CapsulesService],
})
```

---

## Testing Strategy

### Unit Tests

```typescript
describe('CapsulesService.getCapsuleSlots', () => {
  it('사용자의 남은 슬롯을 정상 계산해야 함', async () => {
    // given: totalSlots=10, usedSlots=5
    // when: getCapsuleSlots(userId)
    // then: remainingSlots=5
  });

  it('슬롯을 전혀 사용하지 않은 경우', async () => {
    // given: totalSlots=10, usedSlots=0
    // when: getCapsuleSlots(userId)
    // then: remainingSlots=10
  });

  it('슬롯을 모두 소진한 경우', async () => {
    // given: totalSlots=10, usedSlots=10
    // when: getCapsuleSlots(userId)
    // then: remainingSlots=0
  });

  it('존재하지 않는 사용자인 경우 404 발생', async () => {
    // given: invalid userId
    // when: getCapsuleSlots(userId)
    // then: throw NotFoundException
  });
});
```

### E2E Tests

```typescript
describe('GET /api/capsule/slots', () => {
  it('인증된 사용자는 슬롯 정보를 조회할 수 있다', async () => {
    const response = await request(app)
      .get('/api/capsule/slots')
      .set('Authorization', `Bearer ${validToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('totalSlots');
    expect(response.body).toHaveProperty('usedSlots');
    expect(response.body).toHaveProperty('remainingSlots');
  });

  it('인증 토큰이 없으면 401 에러', async () => {
    await request(app)
      .get('/api/capsule/slots')
      .expect(401);
  });
});
```

---

## Documentation

### Swagger Response Example

```json
{
  "totalSlots": 10,
  "usedSlots": 5,
  "remainingSlots": 5
}
```

### API 사용 예시 (cURL)

```bash
curl -X GET "http://localhost:3000/api/capsule/slots" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

## 구현 순서 요약

1. ✅ **DTO 생성** - `get-capsule-slots.dto.ts`
2. ✅ **Service 로직** - `getCapsuleSlots(userId)` 메서드
3. ✅ **Controller 엔드포인트** - `GET /slots` 추가
4. ✅ **Swagger 문서화** - 데코레이터 추가
5. ✅ **단위 테스트** - Service 로직 검증
6. ✅ **E2E 테스트** - API 엔드포인트 검증
7. ✅ **로컬 검증** - Swagger UI에서 테스트

---

## Notes

- 매우 간단한 READ-ONLY API이므로 트랜잭션 불필요
- 캡슐 생성/삭제 시 슬롯 차감/회복 로직은 별도 구현 필요 (캡슐 CRUD API에서 처리)
- 향후 슬롯 구매/이벤트 기능 추가 시 `egg_slots` 컬럼 업데이트 로직만 추가하면 됨
- 현재 프로젝트에서는 `egg_slots` 기본값이 3개이지만, spec.md에서는 10개로 언급됨 → 확인 필요

