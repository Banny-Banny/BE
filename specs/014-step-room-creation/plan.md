# Implementation Plan: 결제 완료 시 대기실(Step Room) 자동 생성

**Branch**: `014-step-room-creation` | **Date**: 2025-12-31 | **Spec**: `specs/014-step-room-creation/spec.md`  
**Input**: 결제 완료 시 대기실 자동 생성 및 초대 코드 기반 조회 기능

## Summary
- 결제 승인(PAID) 시점에 타임캡슐 대기실(Step Room)을 자동 생성한다.
- 대기실에는 고유한 6자리 초대 코드와 24시간 deadline이 설정된다.
- 주문의 인원수만큼 참여 슬롯을 생성하고, 주문자는 자동으로 첫 번째 슬롯에 배정된다.
- 초대 코드를 통한 대기실 조회 API를 제공한다.

## Technical Context
- **Language/Framework**: TypeScript + NestJS, TypeORM, PostgreSQL
- **Existing modules**: 
  - `payments.service.ts` (결제 승인)
  - `orders.service.ts` (주문 관리)
  - `capsules.service.ts` (캡슐 관리)
  - `capsule-participant-slot.entity.ts` (참여 슬롯 - 기존 엔티티)
- **Auth**: JWT (주문자 기준)
- **Testing**: Jest (단위 테스트), Playwright (E2E)

## Architecture Decisions

### 1. 데이터 모델 선택

**Option A: step_rooms 별도 테이블**
- 장점: 관심사 분리, 대기실 전용 필드 관리
- 단점: 테이블 조인 필요, 관계 복잡도 증가

**Option B: capsules 테이블 확장 (✅ 선택)**
- 장점: 
  - **기존 구조 활용**: 이미 `orderId`, `title`, `openAt`, `viewLimit`, `CapsuleParticipantSlot` 존재
  - **테이블 조인 불필요**: 대기실 = 결제 완료 후 작성 대기 중인 캡슐
  - **Migration 최소화**: 3개 필드만 추가하면 됨
  - **자연스러운 통합**: 캡슐 생성 로직과 통합 용이
- 단점: 대기실과 캡슐 개념이 같은 테이블에 존재
- 구현:
  - `capsules` 테이블에 필드 추가:
    - `invite_code` (varchar(6), unique, nullable)
    - `deadline` (timestamp, nullable)
    - `room_status` (enum: WAITING, COMPLETED, EXPIRED, nullable)
  - `orderId` unique 제약으로 중복 생성 방지 (이미 존재)

### 2. 초대 코드 생성 방식

**알고리즘**: 
- 6자리 영숫자 (0-9, A-Z)
- 혼동 가능 문자 제외: O(오), I(아이), L(엘), 1(일), 0(영)
- 사용 가능 문자: `23456789ABCDEFGHJKMNPQRSTUVWXYZ` (32개)
- 조합 가능 경우의 수: 32^6 = 1,073,741,824 (10억 개 이상)

**중복 방지**:
1. DB unique 제약으로 1차 방어
2. 생성 시 최대 5번 재시도
3. 5번 실패 시 에러 반환 (확률적으로 매우 낮음)

```typescript
const generateInviteCode = (): string => {
  const chars = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
};
```

### 3. Deadline 계산 방식

- 기준: 결제 승인 시각 (`payment.approvedAt`)
- 계산: `approvedAt + 24시간`
- 타임존: UTC 기준 저장, ISO 8601 형식 반환
- 만료 체크: 
  - 콘텐츠 작성 시 `deadline < now` 검증
  - 배치 작업으로 만료된 대기실 상태 업데이트 (선택사항)

## Plan / Steps

### Phase 1: 데이터 모델 구축

#### 1.1 Capsule 엔티티 확장

```typescript
// src/entities/capsule.entity.ts (추가할 필드)

@Entity('capsules')
export class Capsule {
  // ... 기존 필드들 ...

  @Column({
    type: 'varchar',
    length: 6,
    unique: true,
    nullable: true,
    name: 'invite_code',
    comment: '대기실 초대 코드 (결제 완료 후 생성)',
  })
  inviteCode: string | null;

  @Column({
    type: 'timestamp',
    nullable: true,
    comment: '대기실 마감시한 (결제 완료 + 24시간)',
  })
  deadline: Date | null;

  @Column({
    type: 'enum',
    enum: ['WAITING', 'COMPLETED', 'EXPIRED'],
    nullable: true,
    name: 'room_status',
    comment: '대기실 상태 (nullable: 대기실 없음)',
  })
  roomStatus: string | null;

  // ... 기존 필드들 ...
}
```

**기존에 있는 필드 재활용**:
- `orderId` - 주문 연계 (이미 unique)
- `title` - 캡슐 이름 (room name으로 사용)
- `openAt` - 열람 날짜
- `viewLimit` - 인원수 제한
- `participantSlots` - 참여 슬롯 (이미 관계 존재)

#### 1.2 Migration 생성
```bash
npm run migration:generate -- src/migrations/AddCapsuleStepRoomFields
```

- `capsules` 테이블에 컬럼 추가:
  - `invite_code` (varchar(6), unique, nullable)
  - `deadline` (timestamp, nullable)
  - `room_status` (enum, nullable)
- `invite_code` unique index 생성
- `deadline` index 생성 (만료 조회용)

### Phase 2: 대기실 생성 로직

#### 2.1 CapsulesService에 대기실 생성 메서드 추가

```typescript
// src/capsules/capsules.service.ts

async createCapsuleWithStepRoom(orderId: string): Promise<Capsule> {
  return this.dataSource.transaction(async (manager) => {
    // 1. 주문 조회 및 검증
    const order = await manager.findOne(Order, {
      where: { id: orderId },
      relations: ['product', 'user']
    });
    
    if (!order) {
      throw new NotFoundException('주문을 찾을 수 없습니다');
    }
    
    if (order.status !== OrderStatus.PAID) {
      throw new BadRequestException('결제 완료된 주문만 대기실을 생성할 수 있습니다');
    }

    // 2. 기존 캡슐 확인 (중복 생성 방지)
    const existing = await manager.findOne(Capsule, {
      where: { orderId: orderId }
    });
    
    if (existing) {
      return existing;
    }

    // 3. 상품 검증
    if (!order.product.is_active) {
      throw new BadRequestException('비활성 상품입니다');
    }
    
    if (order.product.product_type !== 'TIME_CAPSULE') {
      throw new BadRequestException('타임캡슐 상품만 대기실을 생성할 수 있습니다');
    }

    // 4. 인원수 검증
    if (order.headcount < 1 || order.headcount > 10) {
      throw new BadRequestException('인원수는 1~10명이어야 합니다');
    }

    // 5. 초대 코드 생성 (최대 5번 재시도)
    let inviteCode: string;
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      inviteCode = this.generateInviteCode();
      const exists = await manager.findOne(Capsule, {
        where: { inviteCode: inviteCode }
      });
      
      if (!exists) break;
      attempts++;
    }

    if (attempts === maxAttempts) {
      throw new InternalServerErrorException('초대 코드 생성 실패');
    }

    // 6. Deadline 계산 (결제 승인 시각 + 24시간)
    const deadline = new Date(order.updatedAt);
    deadline.setHours(deadline.getHours() + 24);

    // 7. 열람 시점 계산
    const openAt = order.customOpenAt || this.calculateOpenDate(order.timeOption);

    // 8. 캡슐 생성 (대기실 포함)
    const capsule = manager.create(Capsule, {
      userId: order.userId,
      productId: order.productId,
      orderId: order.id,
      title: order.capsuleName || '나의 타임캡슐',
      content: null,
      mediaUrls: null,
      mediaItemIds: null,
      mediaTypes: null,
      textBlocks: null,
      openAt: openAt,
      isLocked: true,
      viewLimit: order.headcount,
      viewCount: 0,
      // 대기실 필드
      inviteCode: inviteCode,
      deadline: deadline,
      roomStatus: 'WAITING'
    });

    await manager.save(capsule);

    // 9. 참여 슬롯 생성
    await this.createParticipantSlots(capsule.id, order.userId, order.headcount, manager);

    return capsule;
  });
}

private generateInviteCode(): string {
  const chars = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

private async createParticipantSlots(
  capsuleId: string,
  hostUserId: string,
  headcount: number,
  manager: EntityManager
): Promise<void> {
  const slots: CapsuleParticipantSlot[] = [];

  for (let i = 0; i < headcount; i++) {
    const slot = manager.create(CapsuleParticipantSlot, {
      capsuleId: capsuleId,
      userId: i === 0 ? hostUserId : null,
      slotIndex: i,
      assignedAt: i === 0 ? new Date() : null
    });
    slots.push(slot);
  }

  await manager.save(slots);
}
```

#### 2.2 PaymentsService에 훅 연결

```typescript
// src/payments/payments.service.ts

async approve(orderId: string, userId: string, dto: ApprovePaymentDto) {
  // ... 기존 결제 승인 로직 ...

  // 주문 상태를 PAID로 변경
  order.status = OrderStatus.PAID;
  await this.ordersRepository.save(order);

  // 대기실 자동 생성 (캡슐 + 초대 코드 + 슬롯)
  let capsule: Capsule | null = null;
  try {
    capsule = await this.capsulesService.createCapsuleWithStepRoom(orderId);
  } catch (error) {
    this.logger.error(`대기실 생성 실패: ${error.message}`, error.stack);
    // 결제는 성공했으므로 대기실 생성 실패는 별도 처리
    // 옵션 1: 에러 반환 (권장)
    // 옵션 2: 알림 후 계속 진행
  }

  return {
    order_id: order.id,
    status: order.status,
    step_room: capsule ? {
      room_id: capsule.id,
      invite_code: capsule.inviteCode,
      capsule_name: capsule.title,
      open_date: capsule.openAt,
      deadline: capsule.deadline,
      participant_count: capsule.viewLimit,
      created_at: capsule.createdAt
    } : null
  };
}
```

### Phase 3: 대기실 조회 API

#### 3.1 Controller 추가

```typescript
// src/capsules/capsules.controller.ts

@Get('step-rooms')
@ApiOperation({ summary: '초대 코드로 대기실 조회' })
@ApiQuery({ name: 'invite_code', required: true })
async getStepRoomByInviteCode(
  @Query('invite_code') inviteCode: string
): Promise<StepRoomResponseDto> {
  return this.capsulesService.findCapsuleByInviteCode(inviteCode);
}

@Get('step-rooms/:capsuleId')
@UseGuards(JwtAuthGuard)
@ApiOperation({ summary: '대기실 상세 조회 (참여자 전용)' })
async getStepRoomDetail(
  @Param('capsuleId') capsuleId: string,
  @CurrentUser() user: User
): Promise<StepRoomDetailDto> {
  return this.capsulesService.getStepRoomDetail(capsuleId, user.id);
}
```

#### 3.2 Service 메서드 추가

```typescript
// src/capsules/capsules.service.ts

async findCapsuleByInviteCode(inviteCode: string): Promise<StepRoomResponseDto> {
  const capsule = await this.capsulesRepository.findOne({
    where: { inviteCode: inviteCode.toUpperCase() },
    relations: ['participantSlots']
  });

  if (!capsule) {
    throw new NotFoundException('존재하지 않는 초대 코드입니다');
  }

  // 참여자 수 조회
  const slots = await this.slotsRepository.find({
    where: { capsuleId: capsule.id }
  });

  const currentParticipants = slots.filter(s => s.userId !== null).length;
  const isDeadlinePassed = capsule.deadline && new Date() > capsule.deadline;
  const isFull = currentParticipants >= capsule.viewLimit;

  return {
    room_id: capsule.id,
    capsule_name: capsule.title,
    open_date: capsule.openAt,
    deadline: capsule.deadline,
    participant_count: capsule.viewLimit,
    current_participants: currentParticipants,
    status: isDeadlinePassed ? 'EXPIRED' : (capsule.roomStatus || 'WAITING'),
    is_joinable: !isDeadlinePassed && !isFull && capsule.roomStatus === 'WAITING'
  };
}

async getStepRoomDetail(capsuleId: string, userId: string): Promise<StepRoomDetailDto> {
  const capsule = await this.capsulesRepository.findOne({
    where: { id: capsuleId },
    relations: ['participantSlots']
  });

  if (!capsule) {
    throw new NotFoundException('대기실을 찾을 수 없습니다');
  }

  const slots = await this.slotsRepository.find({
    where: { capsuleId: capsule.id },
    relations: ['user'],
    order: { slotIndex: 'ASC' }
  });

  // 권한 확인: 참여자만 조회 가능
  const isParticipant = slots.some(s => s.userId === userId);
  if (!isParticipant) {
    throw new ForbiddenException('참여자만 조회할 수 있습니다');
  }

  return {
    room_id: capsule.id,
    capsule_name: capsule.title,
    open_date: capsule.openAt,
    deadline: capsule.deadline,
    status: capsule.roomStatus || 'WAITING',
    slots: slots.map(slot => ({
      slot_number: slot.slotIndex + 1,
      user_id: slot.userId,
      is_host: slot.slotIndex === 0,
      status: slot.userId ? 'ACCEPTED' : 'PENDING',
      nickname: slot.user?.nickname || null
    }))
  };
}
```

### Phase 4: DTO 정의

```typescript
// src/capsules/dto/step-room-response.dto.ts

export class StepRoomResponseDto {
  @ApiProperty()
  room_id: string;

  @ApiProperty()
  capsule_name: string;

  @ApiProperty()
  open_date: Date;

  @ApiProperty()
  deadline: Date;

  @ApiProperty()
  participant_count: number;

  @ApiProperty()
  current_participants: number;

  @ApiProperty()
  status: string;

  @ApiProperty()
  is_joinable: boolean;
}

export class StepRoomDetailDto {
  @ApiProperty()
  room_id: string;

  @ApiProperty()
  capsule_name: string;

  @ApiProperty()
  open_date: Date;

  @ApiProperty()
  deadline: Date;

  @ApiProperty()
  status: string;

  @ApiProperty({ type: [SlotDto] })
  slots: SlotDto[];
}

export class SlotDto {
  @ApiProperty()
  slot_number: number;

  @ApiProperty({ nullable: true })
  user_id: string | null;

  @ApiProperty()
  is_host: boolean;

  @ApiProperty()
  status: string;

  @ApiProperty({ nullable: true })
  nickname: string | null;
}
```

### Phase 5: 테스트

#### 5.1 단위 테스트

```typescript
// src/capsules/capsules.service.spec.ts

describe('CapsulesService - Step Room', () => {
  describe('createCapsuleWithStepRoom', () => {
    it('should create capsule with step room fields', async () => {
      // Given: PAID 상태의 주문
      const order = createMockOrder({ status: OrderStatus.PAID });
      
      // When
      const capsule = await service.createCapsuleWithStepRoom(order.id);
      
      // Then
      expect(capsule).toBeDefined();
      expect(capsule.inviteCode).toHaveLength(6);
      expect(capsule.orderId).toBe(order.id);
      expect(capsule.deadline).toBeDefined();
      expect(capsule.roomStatus).toBe('WAITING');
    });

    it('should return existing capsule if already created', async () => {
      // Given: 이미 캡슐이 생성된 주문
      const order = createMockOrder({ status: OrderStatus.PAID });
      const existing = await service.createCapsuleWithStepRoom(order.id);
      
      // When: 동일 주문으로 재생성 시도
      const capsule = await service.createCapsuleWithStepRoom(order.id);
      
      // Then: 기존 캡슐 반환
      expect(capsule.id).toBe(existing.id);
    });

    it('should throw error for non-paid order', async () => {
      // Given: PENDING 상태의 주문
      const order = createMockOrder({ status: OrderStatus.PENDING });
      
      // When & Then
      await expect(
        service.createCapsuleWithStepRoom(order.id)
      ).rejects.toThrow(BadRequestException);
    });

    it('should create slots matching headcount', async () => {
      // Given: 3인용 주문
      const order = createMockOrder({ headcount: 3 });
      
      // When
      const capsule = await service.createCapsuleWithStepRoom(order.id);
      const slots = await slotsRepository.find({ 
        where: { capsuleId: capsule.id } 
      });
      
      // Then
      expect(slots).toHaveLength(3);
      expect(slots[0].slotIndex).toBe(0);
      expect(slots[0].userId).toBe(order.userId);
    });
  });

  describe('findCapsuleByInviteCode', () => {
    it('should find capsule by invite code', async () => {
      // Given
      const capsule = await createMockCapsule({ inviteCode: 'ABC123' });
      
      // When
      const result = await service.findCapsuleByInviteCode('abc123');
      
      // Then
      expect(result.room_id).toBe(capsule.id);
    });

    it('should throw 404 for invalid invite code', async () => {
      // When & Then
      await expect(
        service.findCapsuleByInviteCode('INVALID')
      ).rejects.toThrow(NotFoundException);
    });
  });
});
```

#### 5.2 E2E 테스트 (Playwright)

```typescript
// tests/playwright/step-rooms.spec.ts

test.describe('Step Room Creation', () => {
  test('should create capsule with step room on payment approval', async ({ request }) => {
    // Given: 주문 생성
    const order = await createOrder({
      product_id: productId,
      headcount: 3
    });

    // When: 결제 승인
    const response = await request.post(`/api/payments/approve`, {
      data: { order_id: order.id, payment_key: 'test-key' }
    });

    // Then
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.data.step_room).toBeDefined();
    expect(data.data.step_room.invite_code).toHaveLength(6);
    expect(data.data.step_room.deadline).toBeTruthy();
    expect(data.data.step_room.room_id).toBeTruthy();
  });

  test('should find capsule by invite code', async ({ request }) => {
    // Given
    const capsule = await createCapsuleWithStepRoom();
    
    // When
    const response = await request.get(
      `/api/capsules/step-rooms?invite_code=${capsule.inviteCode}`
    );

    // Then
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.data.room_id).toBe(capsule.id);
  });
});
```

## Scope / Out of Scope

### 포함 (In Scope)
- ✅ 결제 완료 시 대기실 자동 생성
- ✅ 초대 코드 발급 및 중복 방지
- ✅ 24시간 deadline 자동 설정
- ✅ 인원수만큼 참여 슬롯 생성
- ✅ 초대 코드 기반 대기실 조회 API
- ✅ 대기실 상세 조회 API (참여자 전용)
- ✅ 중복 생성 방지 로직
- ✅ 단위 테스트 및 E2E 테스트

### 제외 (Out of Scope)
- ❌ 대기실 참여 초대/수락 프로세스 (별도 기능)
- ❌ 참여자별 콘텐츠 작성 UI
- ❌ 대기실 만료 배치 작업 (선택사항)
- ❌ 푸시 알림 (deadline 임박 등)
- ❌ 대기실 삭제/취소 기능
- ❌ 초대 코드 커스터마이징

## Risks / Checks

### 1. 동시성 이슈
- **위험**: 동일 주문으로 동시에 여러 결제 승인 요청이 들어올 경우 중복 생성 가능
- **대응**: 
  - `order_id` unique 제약으로 DB 레벨 방어
  - 트랜잭션 격리 수준 조정 (READ COMMITTED)
  - 재조회 로직으로 기존 대기실 반환

### 2. 초대 코드 충돌
- **위험**: 초대 코드 중복 생성 가능성 (확률적으로 낮음)
- **대응**: 
  - unique 제약으로 DB 레벨 방어
  - 최대 5번 재시도 로직
  - 실패 시 에러 반환 및 로깅

### 3. Deadline 타임존 이슈
- **위험**: 서버/클라이언트 타임존 불일치로 인한 혼란
- **대응**:
  - UTC 기준으로 저장
  - ISO 8601 형식으로 반환
  - 클라이언트에서 로컬 타임존 변환

### 4. 기존 캡슐 생성 로직 영향
- **위험**: 대기실 없이 직접 생성되는 캡슐과의 충돌
- **대응**:
  - Nullable 필드 사용 (`inviteCode`, `deadline`, `roomStatus`)
  - 대기실 필드가 null이면 일반 캡슐, WAITING이면 대기실
  - 기존 캡슐 생성 로직은 대기실 필드를 null로 유지
  - 결제 완료 시에만 대기실 필드 설정

## Dependencies

- TypeORM migration 실행 필요 (Capsule 테이블에 3개 컬럼 추가)
- 기존 `Capsule` 엔티티 확장
- 기존 `CapsuleParticipantSlot` 엔티티 활용 (이미 구현됨)
- `PaymentsService`와 `CapsulesService` 연동 필요

## Benefits of Using Existing Capsule Table

### ✅ 장점
1. **데이터 일관성**: 대기실과 캡슐이 같은 엔티티이므로 상태 전환이 자연스럽다
2. **조인 불필요**: 대기실 조회 시 추가 조인 없이 모든 정보 접근 가능
3. **Migration 최소화**: 3개 컬럼만 추가하면 됨
4. **기존 로직 활용**: `CapsuleParticipantSlot` 관계를 그대로 사용
5. **쿼리 성능**: 테이블 조인이 줄어 조회 성능 향상

### 🤔 고려사항
1. **Nullable 필드**: `inviteCode`, `deadline`, `roomStatus`는 nullable (대기실 없는 캡슐도 존재)
2. **상태 관리**: `roomStatus`가 null이면 일반 캡슐, WAITING이면 대기실
3. **레거시 데이터**: 기존 캡슐은 대기실 필드가 null로 유지됨

## Rollout Plan

1. **Phase 1 (Week 1)**: 데이터 모델 및 Migration
2. **Phase 2 (Week 1-2)**: 대기실 생성 로직 구현
3. **Phase 3 (Week 2)**: 조회 API 구현
4. **Phase 4 (Week 2)**: DTO 및 Swagger 문서화
5. **Phase 5 (Week 3)**: 테스트 작성 및 버그 수정
6. **Phase 6 (Week 3)**: 코드 리뷰 및 배포 준비

