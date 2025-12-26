# Tasks: 결제 완료 시 타임캡슐 자동 생성

## Phase 1: Setup
- [ ] T001 [US-setup] 마이그레이션/DDL 점검: `capsules`에 `order_id`(uuid, unique) 추가 스크립트 설계

## Phase 2: Foundational
- [ ] T002 [US-core] Entity 연계 추가: `capsule.entity.ts`에 `orderId` 컬럼 및 관계 매핑, unique 제약 반영
- [ ] T003 [US-core] Repository/경로 영향도 점검: 기존 캡슐 생성 경로와 `orderId` optional 처리 검토

## Phase 3: User Stories (P1)
- [ ] T004 [US1] 유즈케이스 구현: `createFromPaidOrder(orderId)` 검증/생성 로직 (상태=PAID, 상품 활성/타입, headcount 1~10, media 제약, CUSTOM 시각)
- [ ] T005 [US1] 중복 생성 방지: unique 위반 처리 또는 재조회로 기존 캡슐 반환
- [ ] T006 [US1] 결제 승인 훅: `payments.service.ts`에서 결제 승인 후 유즈케이스 호출, 응답 DTO에 `capsuleId` 포함
- [ ] T007 [US1] 주문 조회 노출: 필요 시 `orders.service/controller` 응답에 `capsuleId` 추가 (이미 생성된 경우)
- [ ] T008 [US1] 로깅/에러 코드: 생성 성공/실패 사유 로깅, 404(상품), 409(중복), 422(옵션 불일치) 정리

## Phase 4: Tests
- [ ] T009 [US1] 단위 테스트: 성공, 중복, 상품 비활성/타입 불일치, 옵션 불일치, CUSTOM 시각 누락
- [ ] T010 [US1] 통합 테스트: 결제 승인 플로우가 `capsuleId`를 반환하고 중복 생성되지 않는지 검증

## Final Phase: Polish
- [ ] T011 [Polish] Swagger/문서 업데이트: 결제 승인 응답 및 주문 조회에 캡슐 ID, 에러 케이스 명시
- [ ] T012 [Polish] 린트/포맷/DDL 반영 및 최종 검수

