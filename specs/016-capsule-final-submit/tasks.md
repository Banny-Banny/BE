# 016 - 타임캡슐 최종 제출 API 구현 태스크

## 진행 상태

- 총 태스크: 9개
- 완료: 0개
- 진행 중: 0개
- 대기 중: 9개

## 태스크 목록

### Task 1: RoomStatus Enum 확장 ⏳
**상태**: 대기 중
**예상 시간**: 10분
**의존성**: 없음

#### 세부 작업
1. `src/common/enums/index.ts` 수정
   - `RoomStatus` enum에 `BURIED = 'BURIED'` 추가
   - 주석 추가: "매장 완료"

#### 완료 기준
- [ ] `BURIED` 상태 추가 완료
- [ ] 타입스크립트 컴파일 에러 없음

#### 예상 코드 변경
```typescript
// src/common/enums/index.ts
export enum RoomStatus {
  WAITING = 'WAITING',       // 작성 대기 중
  COMPLETED = 'COMPLETED',   // 모든 참여자 작성 완료
  EXPIRED = 'EXPIRED',       // 마감시한 경과
  BURIED = 'BURIED',         // 매장 완료 (새로 추가)
}
```

---

### Task 2: 마이그레이션 생성 ⏳
**상태**: 대기 중
**예상 시간**: 30분
**의존성**: Task 1

#### 세부 작업
1. 마이그레이션 파일 생성
   - `src/migrations/TIMESTAMP-add-capsule-buried-fields.ts`
   - `buriedAt` 컬럼 추가 (TIMESTAMP, nullable)
   - `isAutoSubmitted` 컬럼 추가 (BOOLEAN, default false)
   - RoomStatus enum에 `BURIED` 값 추가

2. 마이그레이션 실행
   - `npm run typeorm:run` 실행
   - 데이터베이스 스키마 확인

#### 완료 기준
- [ ] 마이그레이션 파일 생성
- [ ] up/down 메서드 구현
- [ ] 로컬 DB 마이그레이션 성공
- [ ] `capsules` 테이블에 새 컬럼 확인

#### 예상 코드
```typescript
// src/migrations/TIMESTAMP-add-capsule-buried-fields.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCapsuleBuriedFields1735808401000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // BURIED 상태 추가
    await queryRunner.query(`
      ALTER TYPE "capsules_room_status_enum" ADD VALUE IF NOT EXISTS 'BURIED'
    `);

    // buriedAt 컬럼 추가
    await queryRunner.query(`
      ALTER TABLE "capsules"
      ADD COLUMN IF NOT EXISTS "buried_at" TIMESTAMP NULL
    `);

    // isAutoSubmitted 컬럼 추가
    await queryRunner.query(`
      ALTER TABLE "capsules"
      ADD COLUMN IF NOT EXISTS "is_auto_submitted" BOOLEAN DEFAULT false
    `);

    // 컬럼 주석 추가
    await queryRunner.query(`
      COMMENT ON COLUMN "capsules"."buried_at" IS '캡슐이 매장된 시각'
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN "capsules"."is_auto_submitted" IS '자동 제출 여부'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "capsules"
      DROP COLUMN IF EXISTS "is_auto_submitted",
      DROP COLUMN IF EXISTS "buried_at"
    `);
  }
}
```

---

### Task 3: Capsule 엔티티 업데이트 ⏳
**상태**: 대기 중
**예상 시간**: 20분
**의존성**: Task 2

#### 세부 작업
1. `src/entities/capsule.entity.ts` 수정
   - `buriedAt` 필드 추가
   - `isAutoSubmitted` 필드 추가
   - TypeORM 데코레이터 적용

#### 완료 기준
- [ ] 필드 추가 완료
- [ ] 데코레이터 적용 완료
- [ ] 타입스크립트 컴파일 에러 없음

#### 예상 코드
```typescript
// src/entities/capsule.entity.ts에 추가
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

---

### Task 4: DTO 생성 ⏳
**상태**: 대기 중
**예상 시간**: 30분
**의존성**: 없음

#### 세부 작업
1. `src/capsules/dto/submit-capsule.dto.ts` 생성
   - `SubmitCapsuleDto` 클래스 정의
   - 필드: `latitude`, `longitude`
   - Validation 데코레이터 추가
   - Swagger 데코레이터 추가

2. `src/capsules/dto/submit-capsule-response.dto.ts` 생성
   - `SubmitCapsuleResponseDto` 클래스 정의
   - `LocationDto`, `SubmitCapsuleDataDto` 중첩 클래스 정의
   - Swagger 데코레이터 추가

#### 완료 기준
- [ ] DTO 파일 생성 완료
- [ ] 모든 필드에 validation 데코레이터 적용
- [ ] Swagger 문서화 완료
- [ ] 타입스크립트 컴파일 에러 없음

#### 예상 코드
```typescript
// src/capsules/dto/submit-capsule.dto.ts
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

// src/capsules/dto/submit-capsule-response.dto.ts
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

---

### Task 5: Service 검증 메서드 구현 ⏳
**상태**: 대기 중
**예상 시간**: 1시간
**의존성**: Task 3, Task 4

#### 세부 작업
1. `src/capsules/capsules.service.ts`에 검증 메서드 추가

   a. `validateNotAlreadySubmitted()` 구현
      - 캡슐의 `roomStatus`가 `BURIED`인지 확인
      - 이미 제출되었으면 `ConflictException` 던지기

   b. `validateIsRoomOwner()` 구현
      - 캡슐 소유자(`capsule.userId`) 확인
      - 슬롯에서 방장(`slotIndex = 0`) 확인
      - 권한 없으면 `ForbiddenException` 던지기

   c. `validateAllParticipantsCompleted()` 구현
      - 모든 슬롯 조회
      - 배정된 슬롯의 `status = "COMPLETED"` 확인
      - 완료 여부 및 미완료 슬롯 목록 반환

#### 완료 기준
- [ ] 3개 검증 메서드 구현 완료
- [ ] 에러 메시지 및 형식 일치
- [ ] 타입스크립트 컴파일 에러 없음

#### 예상 코드
```typescript
// src/capsules/capsules.service.ts에 추가

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
    relations: ['user'],
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

---

### Task 6: Service 매장 로직 구현 (트랜잭션) ⏳
**상태**: 대기 중
**예상 시간**: 1시간
**의존성**: Task 5

#### 세부 작업
1. `src/capsules/capsules.service.ts`에 메서드 추가

   a. `buryCapsuleTransaction()` 구현
      - 트랜잭션 시작
      - 캡슐 위치 및 상태 업데이트
      - `latitude`, `longitude`, `roomStatus`, `buriedAt`, `isAutoSubmitted` 설정
      - 응답 생성 및 반환

   b. `submitCapsule()` 메인 메서드 구현
      - `ensurePaidCapsuleContext()` 호출 (재사용)
      - 검증 메서드 호출
      - 매장 트랜잭션 실행

#### 완료 기준
- [ ] 트랜잭션 로직 구현 완료
- [ ] 메인 메서드 구현 완료
- [ ] 에러 핸들링 완료
- [ ] 타입스크립트 컴파일 에러 없음

#### 예상 코드
```typescript
// src/capsules/capsules.service.ts에 추가

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
    // TODO: 주소 변환 API 연동
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

/**
 * 타임캡슐 최종 제출
 */
async submitCapsule(
  capsuleId: string,
  userId: string,
  latitude: number,
  longitude: number,
): Promise<SubmitCapsuleResponseDto> {
  // 1. ✅ 재사용: ensurePaidCapsuleContext()
  const { capsule, headcount } = await this.ensurePaidCapsuleContext(capsuleId);

  // 2. 중복 제출 확인
  this.validateNotAlreadySubmitted(capsule);

  // 3. 방장 권한 확인
  await this.validateIsRoomOwner(capsule, userId);

  // 4. 참여자 완료 상태 확인
  const { allCompleted, incompleteSlots } = await this.validateAllParticipantsCompleted(
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
        completed: headcount - incompleteSlots.length,
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

---

### Task 7: Controller 엔드포인트 추가 ⏳
**상태**: 대기 중
**예상 시간**: 30분
**의존성**: Task 6

#### 세부 작업
1. `src/capsules/capsules.controller.ts` 수정
   - `POST /step-rooms/:capsuleId/submit` 엔드포인트 추가
   - JWT 인증 가드 적용
   - Swagger 문서화
   - 에러 응답 예시 추가

#### 완료 기준
- [ ] 엔드포인트 추가 완료
- [ ] Swagger 문서화 완료
- [ ] 컴파일 에러 없음
- [ ] Postman/Insomnia로 API 테스트 가능

#### 예상 코드
```typescript
// src/capsules/capsules.controller.ts에 추가
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

---

### Task 8: CapsulesCronService 구현 ⏳
**상태**: 대기 중
**예상 시간**: 1시간 30분
**의존성**: Task 6

#### 세부 작업
1. `src/capsules/capsules-cron.service.ts` 생성
   - `@Injectable()` 데코레이터 적용
   - 의존성 주입: `CapsuleRepository`, `SlotRepository`, `DataSource`
   - Logger 설정

2. `handleAutoSubmit()` 메서드 구현
   - `@Cron(CronExpression.EVERY_HOUR)` 데코레이터
   - deadline 경과 캡슐 조회
   - 각 캡슐에 대해 `autoSubmitCapsule()` 호출

3. `autoSubmitCapsule()` 메서드 구현
   - 트랜잭션 처리
   - 방장 슬롯 조회
   - 기본 위치 설정 (서울시청)
   - 캡슐 매장 (자동 제출)

4. `src/capsules/capsules.module.ts` 수정
   - `ScheduleModule.forRoot()` 추가
   - `CapsulesCronService` providers에 추가

#### 완료 기준
- [ ] 크론잡 서비스 파일 생성
- [ ] 자동 제출 로직 구현 완료
- [ ] 모듈에 등록 완료
- [ ] 로그 출력 확인
- [ ] 타입스크립트 컴파일 에러 없음

#### 예상 코드
```typescript
// src/capsules/capsules-cron.service.ts
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

      // 방장이 위치를 저장한 경우 (향후 구현)
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
}

// src/capsules/capsules.module.ts에 추가
import { ScheduleModule } from '@nestjs/schedule';
import { CapsulesCronService } from './capsules-cron.service';

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

---

### Task 9: E2E 테스트 작성 ⏳
**상태**: 대기 중
**예상 시간**: 1시간
**의존성**: Task 7, Task 8

#### 세부 작업
1. `tests/playwright/capsule-submit.spec.ts` 생성
   - 수동 제출 성공 시나리오
   - 권한 없음 에러 시나리오
   - 참여자 미완료 에러 시나리오
   - 이미 제출됨 에러 시나리오
   - 자동 제출 시나리오 (크론잡)

2. 테스트 실행 및 디버깅
   - `npm run test:e2e` 실행
   - 실패한 테스트 수정
   - 모든 테스트 통과 확인

#### 완료 기준
- [ ] 테스트 파일 생성
- [ ] 5개 테스트 케이스 구현
- [ ] 모든 테스트 통과
- [ ] 커버리지 80% 이상

#### 예상 코드
```typescript
// tests/playwright/capsule-submit.spec.ts
import { test, expect } from '@playwright/test';

let authToken: string;
let capsuleId: string;
let userId: string;

test.describe('타임캡슐 최종 제출 API', () => {
  test.beforeAll(async ({ request }) => {
    // 사용자 로그인 및 토큰 발급
    // ... 인증 로직
  });

  test('should submit capsule successfully', async ({ request }) => {
    // 1. 캡슐 생성 및 결제
    // 2. 모든 참여자 콘텐츠 저장
    // 3. 방장이 제출
    const response = await request.post(
      `/api/capsules/step-rooms/${capsuleId}/submit`,
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        data: {
          latitude: 37.5665,
          longitude: 126.978,
        },
      },
    );

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('BURIED');
    expect(body.data.is_auto_submitted).toBe(false);
  });

  test('should reject when not room owner', async ({ request }) => {
    // 1. 캡슐 생성
    // 2. 일반 참여자가 제출 시도
    const response = await request.post(
      `/api/capsules/step-rooms/${capsuleId}/submit`,
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        data: {
          latitude: 37.5665,
          longitude: 126.978,
        },
      },
    );

    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(body.error).toBe('NOT_ROOM_OWNER');
  });

  test('should reject when participants incomplete', async ({ request }) => {
    // 1. 캡슐 생성
    // 2. 일부 참여자만 저장
    // 3. 방장이 제출 시도
    const response = await request.post(
      `/api/capsules/step-rooms/${capsuleId}/submit`,
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        data: {
          latitude: 37.5665,
          longitude: 126.978,
        },
      },
    );

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('INCOMPLETE_PARTICIPANTS');
    expect(body.data.completed).toBeLessThan(body.data.total);
  });

  test('should reject when already submitted', async ({ request }) => {
    // 1. 캡슐 제출
    // 2. 다시 제출 시도
    const response = await request.post(
      `/api/capsules/step-rooms/${capsuleId}/submit`,
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        data: {
          latitude: 37.5665,
          longitude: 126.978,
        },
      },
    );

    expect(response.status()).toBe(409);
    const body = await response.json();
    expect(body.error).toBe('ALREADY_SUBMITTED');
  });

  test('should auto-submit after 24 hours', async ({ request }) => {
    // 1. 캡슐 생성 (deadline 경과 상태로 설정)
    // 2. 크론잡 수동 실행 (테스트용)
    // 3. 캡슐 상태 검증
    const response = await request.get(`/api/capsules/${capsuleId}`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.data.status).toBe('BURIED');
    expect(body.data.is_auto_submitted).toBe(true);
  });
});
```

---

## 구현 순서 요약

1. **Task 1**: RoomStatus Enum 확장 (10분)
2. **Task 2**: 마이그레이션 생성 (30분)
3. **Task 3**: Capsule 엔티티 업데이트 (20분)
4. **Task 4**: DTO 생성 (30분)
5. **Task 5**: Service 검증 메서드 구현 (1시간)
6. **Task 6**: Service 매장 로직 구현 (1시간)
7. **Task 7**: Controller 엔드포인트 추가 (30분)
8. **Task 8**: CapsulesCronService 구현 (1시간 30분)
9. **Task 9**: E2E 테스트 작성 (1시간)

**총 예상 소요 시간**: 6시간 30분

## 체크리스트

### 개발 완료 체크리스트
- [ ] 모든 타입스크립트 컴파일 에러 해결
- [ ] ESLint 경고 없음
- [ ] Swagger 문서 정상 표시
- [ ] 모든 E2E 테스트 통과
- [ ] 로컬 환경에서 수동 제출 테스트 완료
- [ ] 크론잡 로그 확인

### 코드 리뷰 체크리스트
- [ ] 재사용 가능한 코드 활용 확인
- [ ] 에러 핸들링 적절성 확인
- [ ] 트랜잭션 처리 확인
- [ ] 로그 레벨 적절성 확인
- [ ] 주석 및 문서화 확인

### 배포 전 체크리스트
- [ ] 마이그레이션 파일 검증
- [ ] 스테이징 환경 테스트
- [ ] 크론잡 스케줄 확인
- [ ] 알림 서비스 연동 (TODO)
- [ ] 롤백 계획 수립

