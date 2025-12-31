# Tasks: 결제 완료 시 대기실(Step Room) 자동 생성

**Branch**: `014-step-room-creation` | **Spec**: `specs/014-step-room-creation/spec.md`

---

## Phase 1: Setup & Data Model

### T001 [Setup] Capsule 엔티티 확장
**Priority**: P1  
**Estimate**: 30m

- [ ] `src/entities/capsule.entity.ts` 파일 수정
- [ ] Capsule 클래스에 필드 추가:
  - `inviteCode` (varchar(6), unique, nullable) - 초대 코드
  - `deadline` (timestamp, nullable) - 마감시한
  - `roomStatus` (enum: WAITING, COMPLETED, EXPIRED, nullable) - 대기실 상태
- [ ] Column 데코레이터 설정:
  - `@Column({ type: 'varchar', length: 6, unique: true, nullable: true })`
  - `@Column({ type: 'timestamp', nullable: true })`
  - `@Column({ type: 'enum', enum: ['WAITING', 'COMPLETED', 'EXPIRED'], nullable: true })`

**Acceptance**:
- Capsule 엔티티에 3개 필드가 추가되고, 컴파일 에러가 없음
- Nullable 설정이 올바르게 적용됨

---

### T002 [Setup] Migration 생성 및 실행
**Priority**: P1  
**Estimate**: 30m

- [ ] Migration 생성:
  ```bash
  npm run migration:generate -- src/migrations/AddCapsuleStepRoomFields
  ```
- [ ] Migration 파일 검증:
  - `capsules` 테이블에 컬럼 추가:
    - `invite_code` (varchar(6), unique, nullable)
    - `deadline` (timestamp, nullable)
    - `room_status` (enum, nullable)
  - `invite_code` unique index 생성
  - `deadline` index 생성
- [ ] Migration 실행 및 테스트:
  ```bash
  npm run migration:run
  ```

**Acceptance**:
- `capsules` 테이블에 3개 컬럼이 추가됨
- 모든 인덱스가 올바르게 설정됨
- 기존 캡슐 데이터는 새 컬럼이 null로 유지됨

---

### T003 [Setup] DTO 파일 생성
**Priority**: P1  
**Estimate**: 45m

- [ ] `src/capsules/dto/step-room-response.dto.ts` 생성
  - `StepRoomResponseDto` (초대 코드 조회용)
  - `StepRoomDetailDto` (상세 조회용)
  - `SlotDto` (참여 슬롯 정보)
- [ ] Swagger 데코레이터 추가 (`@ApiProperty`)
- [ ] `src/capsules/dto/index.ts`에 export 추가

**Acceptance**:
- DTO 파일이 생성되고, 타입 안정성이 확보됨
- Swagger 문서에서 DTO가 올바르게 표시됨

---

## Phase 2: Core Business Logic

### T004 [Core] 초대 코드 생성 유틸 함수 구현
**Priority**: P1  
**Estimate**: 30m

- [ ] `CapsulesService`에 `generateInviteCode()` private 메서드 추가
- [ ] 구현 내용:
  - 6자리 영숫자 생성
  - 혼동 가능 문자 제외 (O, I, L, 1, 0)
  - 사용 가능 문자: `23456789ABCDEFGHJKMNPQRSTUVWXYZ`
- [ ] 단위 테스트 작성:
  - 6자리 생성 확인
  - 대문자만 포함 확인
  - 제외 문자가 포함되지 않는지 확인

**Acceptance**:
- `generateInviteCode()` 메서드가 정상 동작
- 생성된 코드가 6자리이며, 제외 문자가 포함되지 않음

---

### T005 [Core] 참여 슬롯 생성 메서드 구현
**Priority**: P1  
**Estimate**: 1h

- [ ] `CapsulesService`에 `createParticipantSlots()` private 메서드 추가
- [ ] 파라미터:
  - `capsuleId: string`
  - `hostUserId: string`
  - `headcount: number`
  - `manager: EntityManager` (트랜잭션)
- [ ] 로직:
  - headcount만큼 슬롯 생성
  - 첫 번째 슬롯: 주문자 자동 배정, `is_host=true`, `status=ACCEPTED`
  - 나머지 슬롯: `user_id=null`, `is_host=false`, `status=PENDING`
- [ ] 단위 테스트:
  - 3인용 캡슐 생성 시 3개 슬롯 생성 확인
  - 첫 번째 슬롯이 방장으로 설정되는지 확인

**Acceptance**:
- headcount만큼 슬롯이 생성됨
- 방장 슬롯이 올바르게 설정됨

---

### T006 [Core] 대기실 생성 유즈케이스 구현
**Priority**: P1  
**Estimate**: 3h

- [ ] `CapsulesService`에 `createCapsuleWithStepRoom(orderId: string)` 메서드 추가
- [ ] 검증 로직:
  1. 주문 조회 및 존재 확인
  2. 주문 상태 `PAID` 확인
  3. 기존 캡슐 존재 시 재사용 (중복 방지 - orderId로 조회)
  4. 상품 활성화 및 타입(`TIME_CAPSULE`) 확인
  5. 인원수 범위 검증 (1~10)
  6. `CUSTOM` 시 `custom_open_at` 필수 확인
- [ ] 생성 로직:
  1. 초대 코드 생성 (최대 5번 재시도)
  2. Deadline 계산 (`order.updatedAt + 24시간`)
  3. openAt 계산 (order.customOpenAt 또는 timeOption 기반)
  4. Capsule 엔티티 생성 및 저장 (대기실 필드 포함)
  5. 참여 슬롯 생성
- [ ] 트랜잭션으로 모든 작업을 원자적으로 처리
- [ ] 에러 처리:
  - 404: 주문 없음
  - 400: 비활성 상품, 타입 불일치, 인원수 범위 초과
  - 500: 초대 코드 생성 실패

**Acceptance**:
- PAID 주문에 대해 캡슐(대기실)이 생성됨
- 중복 요청 시 기존 캡슐 반환
- 검증 실패 시 적절한 에러 반환

---

### T007 [Core] 결제 승인 훅 연결
**Priority**: P1  
**Estimate**: 1h

- [ ] `PaymentsService.approve()` 메서드 수정
- [ ] 결제 승인 후 `createCapsuleWithStepRoom()` 호출
- [ ] 응답 DTO에 `step_room` 필드 추가:
  - `room_id` (capsule.id)
  - `invite_code` (capsule.inviteCode)
  - `capsule_name` (capsule.title)
  - `open_date` (capsule.openAt)
  - `deadline` (capsule.deadline)
  - `participant_count` (capsule.viewLimit)
  - `created_at` (capsule.createdAt)
- [ ] 에러 처리:
  - 대기실 생성 실패 시 로깅
  - 결제는 성공했으므로 에러 반환 여부 결정 (옵션 논의 필요)

**Acceptance**:
- 결제 승인 응답에 대기실 정보가 포함됨
- 실패 시 적절한 에러 처리

---

## Phase 3: Query APIs

### T008 [API] 초대 코드로 대기실 조회 API
**Priority**: P1  
**Estimate**: 2h

- [ ] `CapsulesController`에 `GET /api/capsules/step-rooms` 엔드포인트 추가
- [ ] Query parameter: `invite_code` (required)
- [ ] `CapsulesService.findCapsuleByInviteCode()` 메서드 구현:
  - 초대 코드로 캡슐 조회 (대소문자 무시 - toUpperCase)
  - 참여 슬롯 수 조회
  - 현재 참여 인원 계산 (userId !== null인 슬롯)
  - deadline 경과 여부 확인
  - 참여 가능 여부 계산
- [ ] 응답:
  - `StepRoomResponseDto`
  - `is_joinable` 플래그
- [ ] 에러 처리:
  - 404: 존재하지 않는 초대 코드
- [ ] Swagger 문서화

**Acceptance**:
- 초대 코드로 대기실(캡슐) 조회 가능
- 대소문자 구분 없이 조회됨
- 응답에 참여 가능 여부가 포함됨

---

### T009 [API] 대기실 상세 조회 API (참여자 전용)
**Priority**: P2  
**Estimate**: 2h

- [ ] `CapsulesController`에 `GET /api/capsules/step-rooms/:capsuleId` 엔드포인트 추가
- [ ] `@UseGuards(JwtAuthGuard)` 적용
- [ ] `CapsulesService.getStepRoomDetail()` 메서드 구현:
  - capsuleId로 캡슐 조회
  - 참여 슬롯 목록 조회 (slotIndex 순 정렬)
  - 권한 확인: 참여자만 조회 가능
  - 각 슬롯의 사용자 정보 포함
- [ ] 응답:
  - `StepRoomDetailDto`
  - 슬롯 목록 (사용자 nickname 포함)
- [ ] 에러 처리:
  - 404: 대기실(캡슐) 없음
  - 403: 권한 없음 (비참여자)
- [ ] Swagger 문서화

**Acceptance**:
- 참여자만 대기실 상세 정보 조회 가능
- 슬롯 목록과 참여자 정보가 올바르게 반환됨

---

## Phase 4: Testing

### T010 [Test] 대기실 생성 단위 테스트
**Priority**: P1  
**Estimate**: 2h

- [ ] `capsules.service.spec.ts`에 테스트 추가:
  1. **성공 케이스**:
     - PAID 주문으로 캡슐(대기실) 생성 성공
     - 초대 코드 6자리 확인
     - deadline이 24시간 후로 설정되는지 확인
     - roomStatus가 'WAITING'인지 확인
  2. **중복 방지**:
     - 동일 주문으로 재생성 시 기존 캡슐 반환
  3. **검증 실패**:
     - PENDING 주문: BadRequestException
     - 비활성 상품: BadRequestException
     - 인원수 범위 초과 (0명, 11명): BadRequestException
     - 존재하지 않는 주문: NotFoundException
  4. **슬롯 생성**:
     - headcount만큼 슬롯 생성 확인
     - 첫 번째 슬롯(slotIndex=0)이 방장에게 배정되는지 확인

**Acceptance**:
- 모든 단위 테스트 통과

---

### T011 [Test] 대기실 조회 단위 테스트
**Priority**: P1  
**Estimate**: 1.5h

- [ ] `capsules.service.spec.ts`에 테스트 추가:
  1. **초대 코드 조회**:
     - 유효한 초대 코드로 캡슐 조회 성공
     - 대소문자 무시 확인 (ABC123 = abc123)
     - 존재하지 않는 코드: NotFoundException
  2. **상세 조회**:
     - 참여자가 조회 성공
     - 비참여자 조회: ForbiddenException
     - 존재하지 않는 캡슐: NotFoundException

**Acceptance**:
- 모든 단위 테스트 통과

---

### T012 [Test] 결제 승인 E2E 테스트
**Priority**: P1  
**Estimate**: 2h

- [ ] `tests/playwright/payments.spec.ts`에 테스트 추가:
  1. **결제 완료 시 대기실 생성**:
     - 주문 생성 → 결제 승인
     - 응답에 `step_room` 필드 확인
     - `invite_code` 6자리 확인
     - `deadline` 존재 확인
     - `room_id`가 capsule.id인지 확인
  2. **중복 방지**:
     - 동일 주문으로 재승인 시도
     - 동일한 `room_id` 반환 확인
  3. **초대 코드 조회**:
     - 생성된 초대 코드로 조회
     - 캡슐 정보 일치 확인

**Acceptance**:
- E2E 테스트 통과
- 실제 플로우가 정상 동작함

---

### T013 [Test] 대기실 조회 E2E 테스트
**Priority**: P2  
**Estimate**: 1.5h

- [ ] `tests/playwright/step-rooms.spec.ts` 파일 생성
- [ ] 테스트 시나리오:
  1. **초대 코드 조회**:
     - 비회원도 조회 가능 확인
     - 참여 가능 여부(`is_joinable`) 확인
  2. **상세 조회 (인증 필요)**:
     - 참여자 로그인 → 상세 조회
     - 슬롯 목록 확인
  3. **권한 확인**:
     - 비참여자 조회 시도 → 403 에러
  4. **Deadline 경과**:
     - (Mock) deadline 경과된 대기실
     - `is_joinable=false` 확인
     - 콘텐츠 작성 시도 → 409 에러

**Acceptance**:
- E2E 테스트 통과
- 권한 및 deadline 검증이 올바르게 동작함

---

## Phase 5: Documentation & Polish

### T014 [Docs] Swagger 문서화
**Priority**: P2  
**Estimate**: 45m

- [ ] `CapsulesController` 메서드에 데코레이터 추가:
  - `@ApiOperation()`: 엔드포인트 설명
  - `@ApiResponse()`: 응답 예시
  - `@ApiQuery()`, `@ApiParam()`: 파라미터 설명
- [ ] DTO에 `@ApiProperty()` 완성
- [ ] 에러 응답 문서화:
  - 404, 400, 403, 409, 500
- [ ] Swagger UI에서 실제 테스트 수행

**Acceptance**:
- Swagger 문서가 명확하고 완전함
- 개발자가 문서만 보고 API 사용 가능

---

### T015 [Docs] README 업데이트
**Priority**: P3  
**Estimate**: 30m

- [ ] `specs/014-step-room-creation/README.md` 생성
- [ ] 기능 개요 작성
- [ ] API 엔드포인트 요약
- [ ] 초대 코드 사용 예시
- [ ] Deadline 관련 주의사항

**Acceptance**:
- 팀원이 README를 읽고 기능을 이해할 수 있음

---

### T016 [Polish] 에러 메시지 다국어 처리
**Priority**: P3  
**Estimate**: 1h

- [ ] 에러 메시지 한글화:
  - "주문을 찾을 수 없습니다"
  - "결제 완료된 주문만 대기실을 생성할 수 있습니다"
  - "존재하지 않는 초대 코드입니다"
  - "마감시한이 지났습니다"
  - "참여자만 조회할 수 있습니다"
- [ ] (선택) i18n 준비 (영어 메시지도 정의)

**Acceptance**:
- 모든 에러 메시지가 사용자 친화적임

---

### T017 [Polish] 로깅 추가
**Priority**: P2  
**Estimate**: 30m

- [ ] 대기실 생성 성공 로그:
  - `[StepRoom] Created: roomId=${roomId}, orderId=${orderId}, inviteCode=${inviteCode}`
- [ ] 대기실 생성 실패 로그:
  - `[StepRoom] Failed to create: orderId=${orderId}, reason=${error.message}`
- [ ] 초대 코드 충돌 로그:
  - `[StepRoom] Invite code collision detected: ${inviteCode}`
- [ ] Logger 레벨 설정 (info, error)

**Acceptance**:
- 운영 중 문제 발생 시 로그로 추적 가능

---

### T018 [Polish] 린트 및 포맷팅
**Priority**: P1  
**Estimate**: 15m

- [ ] 린트 실행:
  ```bash
  npm run lint
  ```
- [ ] 포맷팅:
  ```bash
  npm run format
  ```
- [ ] 타입 체크:
  ```bash
  npm run build
  ```

**Acceptance**:
- 린트 에러 0개
- 빌드 성공

---

## Final Phase: Review & Deploy

### T019 [Review] 코드 리뷰 준비
**Priority**: P1  
**Estimate**: 1h

- [ ] PR 생성:
  - 브랜치: `014-step-room-creation`
  - 타겟: `develop` (또는 `main`)
- [ ] PR 설명 작성:
  - 기능 개요
  - 주요 변경 사항
  - 테스트 결과
  - 스크린샷 (Swagger UI)
- [ ] 체크리스트 확인:
  - [ ] 모든 단위 테스트 통과
  - [ ] 모든 E2E 테스트 통과
  - [ ] Swagger 문서 완성
  - [ ] Migration 스크립트 포함
  - [ ] 린트/포맷팅 통과

**Acceptance**:
- PR이 리뷰 가능한 상태로 준비됨

---

### T020 [Deploy] Migration 적용 및 배포
**Priority**: P1  
**Estimate**: 30m

- [ ] 스테이징 환경 배포:
  - Migration 실행
  - 서버 재시작
  - 기본 동작 확인
- [ ] 프로덕션 배포:
  - Migration 실행 계획 수립
  - 배포 시간 공지
  - 롤백 계획 준비
  - 배포 실행
  - 모니터링 (에러 로그, 응답 시간)

**Acceptance**:
- 프로덕션 환경에서 정상 동작 확인
- 기존 기능 영향 없음

---

## Summary

**Total Tasks**: 20  
**Total Estimate**: ~21.5 hours

### Priority Breakdown
- **P1 (필수)**: 15 tasks (~17.5h)
- **P2 (중요)**: 4 tasks (~3.5h)
- **P3 (부가)**: 1 task (~0.5h)

### Phase Breakdown
1. **Setup & Data Model**: T001-T003 (1.75h) - 기존 테이블 확장으로 시간 단축
2. **Core Business Logic**: T004-T007 (5.5h)
3. **Query APIs**: T008-T009 (4h)
4. **Testing**: T010-T013 (7h)
5. **Documentation & Polish**: T014-T018 (2.75h)
6. **Review & Deploy**: T019-T020 (1.5h)

### Key Changes from Original Plan
- ✅ **StepRoom 별도 테이블 제거**: Capsule 테이블만 사용
- ✅ **3개 컬럼만 추가**: inviteCode, deadline, roomStatus
- ✅ **기존 필드 재활용**: orderId, title, openAt, viewLimit, participantSlots
- ✅ **Migration 최소화**: 새 테이블 생성 없이 컬럼 추가만
- ✅ **조인 불필요**: 대기실 조회 시 성능 향상

### Dependencies
- T001 → T002 (Entity 확장 후 Migration)
- T004, T005 → T006 (유틸 함수 후 유즈케이스)
- T006 → T007 (유즈케이스 후 훅 연결)
- T008, T009 → T013 (API 구현 후 E2E)
- T001-T009 → T010-T013 (구현 완료 후 테스트)
- T010-T013 → T019 (테스트 통과 후 리뷰)

