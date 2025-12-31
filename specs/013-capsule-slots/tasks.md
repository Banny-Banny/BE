# Tasks: 남은 이스터에그 슬롯 조회 API

> **Feature**: `GET /api/capsule/slots` - 사용자의 남은 캡슐 생성 가능 슬롯 개수 조회  
> **Spec**: `specs/013-capsule-slots/spec.md`  
> **Plan**: `specs/013-capsule-slots/plan.md`

---

## Phase 1: DTO 작성

- [ ] **T001** [DTO] Response DTO 작성
  - 파일: `src/capsules/dto/get-capsule-slots.dto.ts`
  - 내용:
    - `GetCapsuleSlotsResponseDto` 클래스 생성
    - 필드: `totalSlots`, `usedSlots`, `remainingSlots` (모두 `number` 타입)
    - Swagger 데코레이터 추가 (`@ApiProperty`)
    - 각 필드에 설명 및 예시 값 추가
  - 완료 조건: DTO 파일 생성 및 export 확인

---

## Phase 2: Service 로직 구현

- [ ] **T002** [Service] UserRepository 주입 확인
  - 파일: `src/capsules/capsules.service.ts`
  - 내용:
    - `CapsulesService` 생성자에 `UserRepository` 주입 확인
    - 이미 주입되어 있으면 skip, 없으면 추가
  - 완료 조건: `@InjectRepository(User)` 확인

- [ ] **T003** [Service] getCapsuleSlots 메서드 구현
  - 파일: `src/capsules/capsules.service.ts`
  - 메서드: `async getCapsuleSlots(userId: string): Promise<GetCapsuleSlotsResponseDto>`
  - 로직:
    1. `userRepository.findOne({ where: { id: userId, deletedAt: IsNull() } })` 로 사용자 조회
    2. 사용자 없으면 `NotFoundException('User not found')` 발생
    3. `totalSlots = user.eggSlots` 가져오기
    4. `capsuleRepository.count({ where: { userId, deletedAt: IsNull() } })` 로 캡슐 개수 카운트
    5. `usedSlots = 캡슐 개수`
    6. `remainingSlots = Math.max(0, totalSlots - usedSlots)` 계산
    7. `{ totalSlots, usedSlots, remainingSlots }` 반환
  - 완료 조건: 메서드 구현 및 타입 체크 통과

---

## Phase 3: Controller 엔드포인트 추가

- [ ] **T004** [Controller] GET /slots 엔드포인트 추가
  - 파일: `src/capsules/capsules.controller.ts`
  - 라우트: `@Get('slots')`
  - 메서드: `getCapsuleSlots(@GetUser() user: User)`
  - 가드: `@UseGuards(JwtAuthGuard)`
  - 로직: `this.capsulesService.getCapsuleSlots(user.id)` 호출 및 반환
  - 완료 조건: 엔드포인트 추가 및 컴파일 성공

- [ ] **T005** [Controller] Swagger 문서화 추가
  - 파일: `src/capsules/capsules.controller.ts`
  - 데코레이터 추가:
    - `@ApiOperation({ summary: '남은 캡슐 슬롯 조회', description: '현재 사용자가 생성 가능한 남은 캡슐 개수 조회' })`
    - `@ApiResponse({ status: 200, description: '슬롯 정보 조회 성공', type: GetCapsuleSlotsResponseDto })`
    - `@ApiResponse({ status: 401, description: '인증 실패' })`
    - `@ApiResponse({ status: 404, description: '사용자를 찾을 수 없음' })`
    - `@ApiBearerAuth()`
  - 완료 조건: Swagger UI에서 API 문서 확인 가능

---

## Phase 4: Module 설정 확인

- [ ] **T006** [Module] TypeORM Repository 등록 확인
  - 파일: `src/capsules/capsules.module.ts`
  - 확인 사항:
    - `TypeOrmModule.forFeature([Capsule, User])` 에 `User` 엔티티 포함 여부
    - 없으면 추가
  - 완료 조건: Module imports 배열에 User 엔티티 등록 확인

---

## Phase 5: 테스트 작성

- [ ] **T007** [Test-Unit] Service 단위 테스트 작성
  - 파일: `src/capsules/capsules.service.spec.ts` (또는 신규 생성)
  - 테스트 케이스:
    1. **정상 케이스**: totalSlots=10, usedSlots=5 → remainingSlots=5
    2. **캡슐 미생성**: totalSlots=10, usedSlots=0 → remainingSlots=10
    3. **슬롯 전체 소진**: totalSlots=10, usedSlots=10 → remainingSlots=0
    4. **추가 슬롯 보유**: totalSlots=15, usedSlots=8 → remainingSlots=7
    5. **사용자 없음**: NotFoundException 발생 확인
  - Mock:
    - `userRepository.findOne()` mock
    - `capsuleRepository.count()` mock
  - 완료 조건: `npm test` 통과

- [ ] **T008** [Test-E2E] API E2E 테스트 작성
  - 파일: `tests/playwright/capsule-slots.spec.ts` (신규 생성)
  - 테스트 케이스:
    1. **인증된 사용자**: 유효한 JWT 토큰으로 요청 → 200 + 올바른 데이터 구조
    2. **인증 실패**: Authorization 헤더 없이 요청 → 401
    3. **유효하지 않은 토큰**: 만료된/잘못된 토큰 → 401
  - 완료 조건: `npm run test:e2e` 통과

---

## Phase 6: 로컬 검증 및 문서화

- [ ] **T009** [Verify] 로컬 개발 환경에서 수동 테스트
  - 실행: `npm run start:dev`
  - Swagger UI 접속: `http://localhost:3000/api/docs`
  - 테스트 항목:
    1. `/api/capsule/slots` 엔드포인트 존재 확인
    2. "Try it out" 버튼으로 실제 요청 (JWT 토큰 필요)
    3. 응답 데이터 구조 확인: `{ totalSlots, usedSlots, remainingSlots }`
    4. 인증 없이 요청 시 401 에러 확인
  - 완료 조건: 모든 테스트 항목 통과

- [ ] **T010** [Lint] 린트 및 포맷 검사
  - 실행: `npm run lint`
  - 수정: 린트 에러가 있으면 수정
  - 완료 조건: 린트 에러 없음

- [ ] **T011** [Docs] README 또는 API 문서 업데이트 (선택)
  - 파일: `README.md` 또는 `docs/` 폴더
  - 내용: 신규 API 엔드포인트 추가
  - 완료 조건: 문서 업데이트 완료 (선택 사항)

---

## Final Phase: 배포 준비

- [ ] **T012** [Final] 최종 체크리스트
  - DTO 작성 완료 ✓
  - Service 로직 구현 완료 ✓
  - Controller 엔드포인트 추가 완료 ✓
  - Swagger 문서화 완료 ✓
  - 단위 테스트 통과 ✓
  - E2E 테스트 통과 ✓
  - 로컬 검증 완료 ✓
  - 린트 에러 없음 ✓
  - PR 준비 (제목, 설명, 스크린샷 등)

---

## Task Summary

| Phase | Task ID | Description | Priority | Estimated Time |
|-------|---------|-------------|----------|----------------|
| 1 | T001 | Response DTO 작성 | High | 10분 |
| 2 | T002 | UserRepository 주입 확인 | High | 5분 |
| 2 | T003 | getCapsuleSlots 메서드 구현 | High | 20분 |
| 3 | T004 | GET /slots 엔드포인트 추가 | High | 10분 |
| 3 | T005 | Swagger 문서화 추가 | High | 10분 |
| 4 | T006 | TypeORM Repository 등록 확인 | Medium | 5분 |
| 5 | T007 | Service 단위 테스트 작성 | High | 30분 |
| 5 | T008 | API E2E 테스트 작성 | Medium | 20분 |
| 6 | T009 | 로컬 수동 테스트 | High | 10분 |
| 6 | T010 | 린트 및 포맷 검사 | Medium | 5분 |
| 6 | T011 | 문서 업데이트 (선택) | Low | 10분 |
| 7 | T012 | 최종 체크리스트 | High | 5분 |

**Total Estimated Time**: ~2.5시간 (테스트 포함)

---

## Dependencies

### 선행 작업
- ✅ `User` 엔티티에 `eggSlots` 컬럼 존재 확인 (이미 존재함)
- ✅ `Capsule` 엔티티 존재 확인 (이미 존재함)
- ✅ JWT 인증 구현 완료 (`JwtAuthGuard`, `@GetUser()` 데코레이터)

### 후속 작업 (별도 이슈)
- 캡슐 생성 시 슬롯 차감 로직 추가
- 캡슐 삭제 시 슬롯 회복 로직 추가
- 슬롯 구매 API 구현
- 슬롯 부족 시 프론트엔드 안내 메시지

---

## Notes

- 이 기능은 READ-ONLY API이므로 트랜잭션이나 락 처리 불필요
- 매우 간단한 기능이므로 빠르게 구현 가능 (핵심 로직 1시간 이내)
- 테스트 작성에 시간을 더 투자하여 안정성 확보
- 캡슐 생성/삭제 API와의 연동은 별도 태스크로 분리

