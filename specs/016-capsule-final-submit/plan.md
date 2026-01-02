# 016 - 타임캡슐 최종 제출 API 구현 계획

## 0. 코드 재사용 분석

### 0.1 재사용 가능한 기존 메서드

#### ✅ CapsuleService (capsules.service.ts)

1. **`ensurePaidCapsuleContext(capsuleId)`** (814-838줄)
   - 캡슐 조회 + 결제 상태 검증
   - order, product, headcount 정보 반환
   - ✅ **재사용**: 결제 완료 캡슐 검증에 활용

2. **`slotRepository.find()`** (여러 곳)
   - 참여자 슬롯 조회
   - ✅ **재사용**: 방장 확인 및 참여자 완료 상태 확인

3. **`dataSource.transaction()`** (여러 메서드)
   - 트랜잭션 패턴
   - ✅ **재사용**: 제출 시 동시성 제어

4. **`validateStepRoomAccess()`** (1403-1433줄)
   - 스텝룸 접근 권한 검증
   - ✅ **참고**: 방장 권한 검증 로직 참고

#### ✅ RoomStatus enum (common/enums/index.ts)

- `WAITING`: 작성 대기 중
- `COMPLETED`: 모든 참여자 작성 완료
- `EXPIRED`: 마감시한 경과
- ⚠️ **새 상태 필요**: `BURIED` (매장 완료)

### 0.2 기존 엔티티 활용

#### Capsule
- 현재 필드: `roomStatus`, `latitude`, `longitude`, `inviteCode`, `deadline` 등
- ⚠️ **추가 필드 필요**:
  - `buriedAt`: TIMESTAMP (매장 시각)
  - `isAutoSubmitted`: BOOLEAN (자동 제출 여부)
- 💡 **마이그레이션 필요**: 새로운 컬럼 추가

#### CapsuleParticipantSlot
- 현재 필드: `status` (`PENDING` | `COMPLETED`)
- ✅ **재사용**: 모든 슬롯의 `status = "COMPLETED"` 확인
- ✅ **재사용**: `slotIndex = 0` 또는 `userId = capsule.userId`로 방장 확인

#### Order
- 현재 필드: `createdAt`, `updatedAt`, `status`
- ✅ **재사용**: deadline 계산 기준 (`paidAt` 또는 `updatedAt` + 24시간)

### 0.3 라우터명 통일

기존 step-room 엔드포인트:
- `GET /api/capsules/step-rooms` (초대 코드로 조회)
- `GET /api/capsules/step-rooms/:capsuleId/settings`
- `GET /api/capsules/step-rooms/:capsuleId` (상세 조회)
- `POST /api/capsules/step-rooms/:capsuleId/my-content` (콘텐츠 저장)

✅ **새로운 엔드포인트**:
- `POST /api/capsules/step-rooms/:capsuleId/submit`

### 0.4 구현 전략

1. **마이그레이션 생성**: Capsule에 `buriedAt`, `isAutoSubmitted` 필드 추가
2. **Enum 확장**: RoomStatus에 `BURIED` 상태 추가
3. **기존 메서드 재사용**: `ensurePaidCapsuleContext()`, 슬롯 조회 로직
4. **새로운 검증 로직**: 방장 권한, 참여자 완료 상태, 중복 제출 방지
5. **크론잡 구현**: NestJS `@nestjs/schedule` 활용

## 1. 아키텍처 설계

### 1.1 컴포넌트 구조

```
capsules/
├── capsules.controller.ts (기존 파일 - 엔드포인트 추가)
├── capsules.service.ts (기존 파일 - 메서드 추가)
├── capsules-cron.service.ts (새로 생성 - 자동 제출 크론잡)
├── dto/
│   ├── submit-capsule.dto.ts (새로 생성)
│   └── submit-capsule-response.dto.ts (새로 생성)
common/enums/
└── index.ts (기존 파일 - RoomStatus enum 확장)
migrations/
└── TIMESTAMP-add-capsule-buried-fields.ts (새로 생성)
```

### 1.2 의존성
- **CapsulesService**: 기존 서비스 확장
- **CapsulesCronService**: 자동 제출 크론잡 (새로 생성)
- **TypeORM**: 데이터베이스 처리
- **JWT Guard**: 인증 처리
- **@nestjs/schedule**: 크론잡 스케줄링

## 2. 데이터베이스 마이그레이션

### 2.1 RoomStatus enum 확장

```typescript
// common/enums/index.ts에 추가
export enum RoomStatus {
  WAITING = 'WAITING',       // 작성 대기 중
  COMPLETED = 'COMPLETED',   // 모든 참여자 작성 완료
  EXPIRED = 'EXPIRED',       // 마감시한 경과
  BURIED = 'BURIED',         // 매장 완료 (새로 추가)
}
```

### 2.2 Capsule 필드 추가

```typescript
// migrations/TIMESTAMP-add-capsule-buried-fields.ts
export class AddCapsuleBuriedFields implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // BURIED 상태 추가
    await queryRunner.query(`
      ALTER TYPE "capsules_room_status_enum" ADD VALUE 'BURIED'
    `);

    // buriedAt 컬럼 추가
    await queryRunner.query(`
      ALTER TABLE "capsules"
      ADD COLUMN "buried_at" TIMESTAMP
      COMMENT '캡슐이 매장된 시각'
    `);

    // isAutoSubmitted 컬럼 추가
    await queryRunner.query(`
      ALTER TABLE "capsules"
      ADD COLUMN "is_auto_submitted" BOOLEAN DEFAULT false
      COMMENT '자동 제출 여부'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "capsules"
      DROP COLUMN IF EXISTS "is_auto_submitted",
      DROP COLUMN IF EXISTS "buried_at"
    `);

    // BURIED enum 값 제거는 PostgreSQL에서 직접 지원하지 않음
    // 필요 시 enum 재생성 또는 수동 처리 필요
  }
}
```

### 2.3 Capsule 엔티티 업데이트

```typescript
// entities/capsule.entity.ts에 추가
@Column({
  type: 'timestamp',
  nullable: true,
  name: 'buried_at',
  comment: '캡슐이 매장된 시각',
})
buriedAt: Date | null;

@Column({
  type: 'boolean',
  default: false,
  name: 'is_auto_submitted',
  comment: '자동 제출 여부',
})
isAutoSubmitted: boolean;
```

## 3. API 구현

### 3.1 Controller 메서드

```typescript
// capsules.controller.ts에 추가
@Post('step-rooms/:capsuleId/submit')
@UseGuards(JwtAuthGuard)
@ApiTags('Capsules')
@ApiBearerAuth('access-token')
@ApiOperation({
  summary: '타임캡슐 최종 제출',
  description: '방장이 모든 참여자 완료 후 현재 위치에 타임캡슐을 매장합니다.',
})
@ApiResponse({
  status: 200,
  description: '제출 성공',
  type: SubmitCapsuleResponseDto,
})
@ApiResponse({
  status: 403,
  description: '권한 없음',
  schema: {
    example: {
      success: false,
      error: 'NOT_ROOM_OWNER',
      message: '방장만 최종 제출할 수 있습니다',
    },
  },
})
@ApiResponse({
  status: 400,
  description: '참여자 미완료',
  schema: {
    example: {
      success: false,
      error: 'INCOMPLETE_PARTICIPANTS',
      message: '모든 참여자가 저장을 완료해야 제출할 수 있습니다',
      data: {
        completed: 2,
        total: 4,
        incomplete_users: ['박초롱', '김철수'],
      },
    },
  },
})
@ApiResponse({
  status: 409,
  description: '이미 제출됨',
  schema: {
    example: {
      success: false,
      error: 'ALREADY_SUBMITTED',
      message: '이미 제출된 캡슐입니다',
    },
  },
})
async submitCapsule(
  @Param('capsuleId', ParseUUIDPipe) capsuleId: string,
  @CurrentUser() user: User,
  @Body() submitDto: SubmitCapsuleDto,
): Promise<SubmitCapsuleResponseDto> {
  return this.capsulesService.submitCapsule(
    capsuleId,
    user.id,
    submitDto.latitude,
    submitDto.longitude,
  );
}
```

### 3.2 DTO 정의

#### SubmitCapsuleDto

```typescript
// dto/submit-capsule.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsNotEmpty, Min, Max } from 'class-validator';

export class SubmitCapsuleDto {
  @ApiProperty({
    description: '위도 (방장의 현재 위치)',
    example: 37.5665,
  })
  @IsNumber()
  @IsNotEmpty()
  @Min(-90)
  @Max(90)
  latitude: number;

  @ApiProperty({
    description: '경도 (방장의 현재 위치)',
    example: 126.978,
  })
  @IsNumber()
  @IsNotEmpty()
  @Min(-180)
  @Max(180)
  longitude: number;
}
```

#### SubmitCapsuleResponseDto

```typescript
// dto/submit-capsule-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class LocationDto {
  @ApiProperty({ description: '위도' })
  latitude: number;

  @ApiProperty({ description: '경도' })
  longitude: number;

  @ApiProperty({ description: '주소 (향후 구현)', required: false })
  address?: string;
}

export class SubmitCapsuleDataDto {
  @ApiProperty({ description: '캡슐 ID' })
  capsule_id: string;

  @ApiProperty({ description: '상태', example: 'BURIED' })
  status: string;

  @ApiProperty({ description: '매장 위치', type: LocationDto })
  location: LocationDto;

  @ApiProperty({ description: '매장 시각' })
  buried_at: Date;

  @ApiProperty({ description: '개봉 예정일' })
  open_date: Date;

  @ApiProperty({ description: '참여자 수' })
  participants: number;

  @ApiProperty({ description: '자동 제출 여부' })
  is_auto_submitted: boolean;
}

export class SubmitCapsuleResponseDto {
  @ApiProperty({ description: '성공 여부' })
  success: boolean;

  @ApiProperty({ description: '응답 데이터', type: SubmitCapsuleDataDto })
  data: SubmitCapsuleDataDto;
}
```

## 4. Service 로직

### 4.1 메인 비즈니스 로직 (재사용 메서드 활용)

```typescript
// capsules.service.ts에 추가
async submitCapsule(
  capsuleId: string,
  userId: string,
  latitude: number,
  longitude: number,
): Promise<SubmitCapsuleResponseDto> {
  // 1. ✅ 재사용: ensurePaidCapsuleContext()
  const { capsule, order, headcount } = await this.ensurePaidCapsuleContext(capsuleId);

  // 2. 중복 제출 확인 (새로 구현)
  this.validateNotAlreadySubmitted(capsule);

  // 3. 방장 권한 확인 (새로 구현)
  await this.validateIsRoomOwner(capsule, userId);

  // 4. 참여자 완료 상태 확인 (새로 구현)
  const { allCompleted, incompleteSlo ts } = await this.validateAllParticipantsCompleted(
    capsuleId,
    headcount,
  );

  if (!allCompleted) {
    const incompleteUsers = incompleteSlots
      .filter((s) => s.nickname)
      .map((s) => s.nickname!);

    throw new BadRequestException({
      success: false,
      error: 'INCOMPLETE_PARTICIPANTS',
      message: '모든 참여자가 저장을 완료해야 제출할 수 있습니다',
      data: {
        completed: incompleteSlots.filter((s) => s.status === 'COMPLETED').length,
        total: headcount,
        incomplete_users: incompleteUsers.length > 0 ? incompleteUsers : ['미참여자'],
      },
    });
  }

  // 5. 캡슐 매장 (트랜잭션)
  return await this.buryCapsuleTransaction(
    capsule,
    latitude,
    longitude,
    headcount,
    false, // 수동 제출
  );
}
```

### 4.2 검증 메서드 (새로 구현)

#### 4.2.1 중복 제출 확인

```typescript
/**
 * 이미 제출된 캡슐인지 확인
 */
private validateNotAlreadySubmitted(capsule: Capsule): void {
  if (capsule.roomStatus === RoomStatus.BURIED) {
    throw new ConflictException({
      success: false,
      error: 'ALREADY_SUBMITTED',
      message: '이미 제출된 캡슐입니다',
    });
  }
}
```

#### 4.2.2 방장 권한 확인

```typescript
/**
 * 방장 권한 확인
 */
private async validateIsRoomOwner(capsule: Capsule, userId: string): Promise<void> {
  // 1. 캡슐 소유자 확인
  if (capsule.userId === userId) {
    return;
  }

  // 2. 슬롯에서 방장 확인 (slotIndex = 0)
  const ownerSlot = await this.slotRepository.findOne({
    where: { capsuleId: capsule.id, slotIndex: 0 },
  });

  if (ownerSlot && ownerSlot.userId === userId) {
    return;
  }

  // 권한 없음
  throw new ForbiddenException({
    success: false,
    error: 'NOT_ROOM_OWNER',
    message: '방장만 최종 제출할 수 있습니다',
  });
}
```

#### 4.2.3 참여자 완료 상태 확인

```typescript
/**
 * 모든 참여자 완료 상태 확인
 */
private async validateAllParticipantsCompleted(
  capsuleId: string,
  headcount: number,
): Promise<{
  allCompleted: boolean;
  incompleteSlots: CapsuleParticipantSlot[];
}> {
  const slots = await this.slotRepository.find({
    where: { capsuleId },
    order: { slotIndex: 'ASC' },
  });

  // 배정된 슬롯만 확인
  const assignedSlots = slots.filter((s) => s.userId !== null);

  // 모든 배정된 슬롯이 COMPLETED 상태인지 확인
  const completedSlots = assignedSlots.filter((s) => s.status === 'COMPLETED');
  const allCompleted = assignedSlots.length === headcount && completedSlots.length === headcount;

  return {
    allCompleted,
    incompleteSlots: assignedSlots.filter((s) => s.status !== 'COMPLETED'),
  };
}
```

### 4.3 매장 로직 (트랜잭션)

```typescript
/**
 * 캡슐 매장 (트랜잭션)
 */
private async buryCapsuleTransaction(
  capsule: Capsule,
  latitude: number,
  longitude: number,
  headcount: number,
  isAutoSubmitted: boolean,
): Promise<SubmitCapsuleResponseDto> {
  return await this.dataSource.transaction(async (manager) => {
    const capsuleRepo = manager.getRepository(Capsule);

    // 1. 위치 및 상태 업데이트
    capsule.latitude = latitude;
    capsule.longitude = longitude;
    capsule.roomStatus = RoomStatus.BURIED;
    capsule.buriedAt = new Date();
    capsule.isAutoSubmitted = isAutoSubmitted;

    await capsuleRepo.save(capsule);

    // 2. 응답 생성
    // TODO: 주소 변환 API 연동 (Google Maps Geocoding 등)
    const address = '서울특별시 중구 세종대로 110'; // 임시

    return {
      success: true,
      data: {
        capsule_id: capsule.id,
        status: 'BURIED',
        location: {
          latitude: capsule.latitude,
          longitude: capsule.longitude,
          address,
        },
        buried_at: capsule.buriedAt!,
        open_date: capsule.openAt!,
        participants: headcount,
        is_auto_submitted: isAutoSubmitted,
      },
    };
  });
}
```

## 5. 자동 제출 크론잡

### 5.1 CapsulesCronService 생성

```typescript
// capsules/capsules-cron.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource, LessThan, In } from 'typeorm';
import { Capsule } from '../entities/capsule.entity';
import { CapsuleParticipantSlot } from '../entities/capsule-participant-slot.entity';
import { RoomStatus } from '../common/enums';

@Injectable()
export class CapsulesCronService {
  private readonly logger = new Logger(CapsulesCronService.name);

  constructor(
    @InjectRepository(Capsule)
    private readonly capsuleRepository: Repository<Capsule>,
    @InjectRepository(CapsuleParticipantSlot)
    private readonly slotRepository: Repository<CapsuleParticipantSlot>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 매 시간 실행: deadline 경과 캡슐 자동 제출
   */
  @Cron(CronExpression.EVERY_HOUR)
  async handleAutoSubmit(): Promise<void> {
    this.logger.log('🕐 [크론잡 시작] 자동 제출 처리 시작');

    try {
      // 1. deadline 경과 + 미제출 캡슐 조회
      const now = new Date();
      const expiredCapsules = await this.capsuleRepository.find({
        where: {
          deadline: LessThan(now),
          roomStatus: In([RoomStatus.WAITING, RoomStatus.COMPLETED]),
          deletedAt: null,
        },
        relations: ['order'],
      });

      this.logger.log(`✅ 자동 제출 대상 캡슐: ${expiredCapsules.length}개`);

      if (expiredCapsules.length === 0) {
        return;
      }

      // 2. 각 캡슐 자동 매장
      for (const capsule of expiredCapsules) {
        try {
          await this.autoSubmitCapsule(capsule);
          this.logger.log(`✅ 캡슐 자동 제출 완료: ${capsule.id}`);
        } catch (error) {
          this.logger.error(
            `❌ 캡슐 자동 제출 실패: ${capsule.id}`,
            error instanceof Error ? error.stack : error,
          );
        }
      }

      this.logger.log('🎉 [크론잡 완료] 자동 제출 처리 완료');
    } catch (error) {
      this.logger.error(
        '❌ [크론잡 에러] 자동 제출 처리 중 오류 발생',
        error instanceof Error ? error.stack : error,
      );
    }
  }

  /**
   * 개별 캡슐 자동 제출
   */
  private async autoSubmitCapsule(capsule: Capsule): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const capsuleRepo = manager.getRepository(Capsule);
      const slotRepo = manager.getRepository(CapsuleParticipantSlot);

      // 1. 방장 슬롯 조회
      const ownerSlot = await slotRepo.findOne({
        where: { capsuleId: capsule.id, slotIndex: 0 },
      });

      // 2. 기본 위치 설정
      let latitude = 37.5665; // 서울시청 (기본값)
      let longitude = 126.978;

      // 방장이 위치를 저장한 경우 (향후 구현: 슬롯에 위치 저장)
      // if (ownerSlot?.savedLatitude) {
      //   latitude = ownerSlot.savedLatitude;
      //   longitude = ownerSlot.savedLongitude;
      // }

      // 3. 캡슐 매장
      capsule.latitude = latitude;
      capsule.longitude = longitude;
      capsule.roomStatus = RoomStatus.BURIED;
      capsule.buriedAt = new Date();
      capsule.isAutoSubmitted = true;

      await capsuleRepo.save(capsule);

      // 4. TODO: 알림 발송 (참여자 전원)
      // await this.sendAutoSubmitNotifications(capsule);
    });
  }

  /**
   * TODO: 자동 제출 알림 발송
   */
  // private async sendAutoSubmitNotifications(capsule: Capsule): Promise<void> {
  //   // 푸시/이메일 알림 발송 로직
  // }
}
```

### 5.2 CapsulesCronService 모듈 등록

```typescript
// capsules/capsules.module.ts에 추가
import { CapsulesCronService } from './capsules-cron.service';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ScheduleModule.forRoot(), // 크론잡 활성화
    // ... 기존 imports
  ],
  providers: [
    CapsulesService,
    CapsulesCronService, // 크론잡 서비스 추가
  ],
  // ...
})
export class CapsulesModule {}
```

## 6. 에러 처리

### 6.1 에러 코드 목록

- `CAPSULE_NOT_FOUND`: 캡슐을 찾을 수 없음 (404) - ✅ ensurePaidCapsuleContext에서 자동 처리
- `CAPSULE_PAYMENT_REQUIRED`: 결제가 완료되지 않음 (403) - ✅ ensurePaidCapsuleContext에서 자동 처리
- `NOT_ROOM_OWNER`: 방장이 아님 (403)
- `INCOMPLETE_PARTICIPANTS`: 참여자 미완료 (400)
- `ALREADY_SUBMITTED`: 이미 제출됨 (409)

## 7. Swagger 문서화

Controller 메서드에 이미 적용됨 (3.1 참고)

## 8. 테스트 계획

### 8.1 단위 테스트

- `validateNotAlreadySubmitted()`: 중복 제출 확인
- `validateIsRoomOwner()`: 방장 권한 확인
- `validateAllParticipantsCompleted()`: 참여자 완료 상태 확인

### 8.2 통합 테스트

- 수동 제출 성공 시나리오
- 방장이 아닌 사용자 제출 시도 (에러)
- 참여자 미완료 상태 제출 시도 (에러)
- 이미 제출된 캡슐 재제출 시도 (에러)

### 8.3 E2E 테스트 (Playwright)

```typescript
// tests/playwright/capsule-submit.spec.ts
import { test, expect } from '@playwright/test';

test('should submit capsule successfully', async ({ request }) => {
  // 1. 캡슐 생성 및 결제
  // 2. 모든 참여자 콘텐츠 저장
  // 3. 방장이 제출
  // 4. 응답 검증: status = "BURIED"
});

test('should reject when not room owner', async ({ request }) => {
  // 1. 캡슐 생성
  // 2. 일반 참여자가 제출 시도
  // 3. 403 에러 검증: NOT_ROOM_OWNER
});

test('should reject when participants incomplete', async ({ request }) => {
  // 1. 캡슐 생성
  // 2. 일부 참여자만 저장
  // 3. 방장이 제출 시도
  // 4. 400 에러 검증: INCOMPLETE_PARTICIPANTS
});

test('should reject when already submitted', async ({ request }) => {
  // 1. 캡슐 제출
  // 2. 다시 제출 시도
  // 3. 409 에러 검증: ALREADY_SUBMITTED
});

test('should auto-submit after 24 hours', async () => {
  // 1. 캡슐 생성 (deadline 경과 상태로 설정)
  // 2. 크론잡 실행
  // 3. 캡슐 상태 검증: status = "BURIED", isAutoSubmitted = true
});
```

## 9. 보안 고려사항

### 9.1 인증 및 권한

- JWT 토큰 검증
- 방장 권한 확인
- 중복 제출 방지

### 9.2 데이터 검증

- DTO 유효성 검사 (위도/경도 범위)
- SQL Injection 방지 (TypeORM 사용)
- 트랜잭션으로 동시성 문제 방지

## 10. 성능 최적화

### 10.1 데이터베이스 쿼리 최적화

- ✅ `ensurePaidCapsuleContext()` 재사용으로 쿼리 최적화
- 인덱스 활용 (capsule_id, user_id, deadline)
- 트랜잭션 최소화

### 10.2 크론잡 최적화

- 대량 처리 시 배치 처리
- 실패 시 재시도 로직 (향후 구현)
- 알림 발송은 비동기 처리

## 11. 구현 순서

### Phase 1: 데이터베이스 및 Enum (30분)
1. ✅ RoomStatus enum에 `BURIED` 추가
2. ✅ 마이그레이션 생성: Capsule 필드 추가
3. ✅ 엔티티 업데이트: Capsule

### Phase 2: DTO 생성 (30분)
4. ✅ `SubmitCapsuleDto` 생성
5. ✅ `SubmitCapsuleResponseDto` 생성

### Phase 3: Service 로직 (2시간)
6. ✅ `validateNotAlreadySubmitted()` 구현
7. ✅ `validateIsRoomOwner()` 구현
8. ✅ `validateAllParticipantsCompleted()` 구현
9. ✅ `buryCapsuleTransaction()` 구현
10. ✅ `submitCapsule()` 메인 메서드 구현

### Phase 4: Controller (30분)
11. ✅ `submitCapsule()` 엔드포인트 추가
12. ✅ Swagger 문서화

### Phase 5: 크론잡 (1시간)
13. ✅ `CapsulesCronService` 생성
14. ✅ `handleAutoSubmit()` 구현
15. ✅ `autoSubmitCapsule()` 구현
16. ✅ CapsulesModule에 등록

### Phase 6: 테스트 (1시간)
17. ✅ E2E 테스트 작성
18. ✅ 테스트 실행 및 디버깅

**총 예상 소요 시간**: 5시간 30분

## 12. 배포 고려사항

### 12.1 환경 변수

기존 환경 변수 활용 (추가 불필요)

### 12.2 서버 설정

- 크론잡 활성화 확인
- 타임존 설정 (Asia/Seoul)
- 로그 모니터링 설정

## 13. 모니터링

### 13.1 로깅

- 제출 성공/실패 로그
- 크론잡 실행 로그
- 자동 제출 성공/실패 로그

### 13.2 메트릭

- 수동 제출 요청 수
- 자동 제출 캡슐 수
- 평균 응답 시간
- 에러율

## 14. 문서화

- ✅ API 문서 (Swagger)
- 에러 코드 가이드
- 크론잡 실행 가이드

## 15. 재사용 요약

### ✅ 재사용하는 메서드
1. `ensurePaidCapsuleContext()`: 캡슐 조회 + 결제 검증
2. `slotRepository.find()`: 참여자 슬롯 조회
3. `dataSource.transaction()`: 트랜잭션 패턴

### 🆕 새로 구현하는 메서드
1. CapsuleService.`validateNotAlreadySubmitted()`: 중복 제출 확인
2. CapsuleService.`validateIsRoomOwner()`: 방장 권한 확인
3. CapsuleService.`validateAllParticipantsCompleted()`: 참여자 완료 상태 확인
4. CapsuleService.`buryCapsuleTransaction()`: 캡슐 매장 (트랜잭션)
5. CapsuleService.`submitCapsule()`: 메인 비즈니스 로직
6. CapsulesCronService.`handleAutoSubmit()`: 크론잡 메인 로직
7. CapsulesCronService.`autoSubmitCapsule()`: 개별 캡슐 자동 제출

### 📦 새로 생성하는 파일
1. `common/enums/index.ts` (수정): RoomStatus enum 확장
2. `migrations/TIMESTAMP-add-capsule-buried-fields.ts`
3. `dto/submit-capsule.dto.ts`
4. `dto/submit-capsule-response.dto.ts`
5. `capsules/capsules-cron.service.ts`
6. `tests/playwright/capsule-submit.spec.ts`

### ✏️ 수정하는 파일
1. `entities/capsule.entity.ts`: 필드 추가
2. `capsules.controller.ts`: 엔드포인트 추가
3. `capsules.service.ts`: 메서드 추가
4. `capsules.module.ts`: 크론잡 서비스 등록

## 16. TODO (향후 구현)

1. **주소 변환 API 연동**: Google Maps Geocoding API로 위도/경도 → 주소 변환
2. **알림 발송**: 자동 제출 시 참여자 전원에게 푸시/이메일 알림
3. **방장 위치 저장**: 콘텐츠 저장 시 방장의 위치 기록하여 자동 제출 시 활용
4. **재시도 로직**: 크론잡 실패 시 재시도 메커니즘
5. **성능 모니터링**: APM 도구 연동 (DataDog, New Relic 등)

