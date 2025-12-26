# Implementation Plan: 결제 완료 시 타임캡슐 자동 생성

**Branch**: `008-capsule-create-on-order` | **Date**: 2025-12-26 | **Spec**: `specs/008-capsule-create-on-order/spec.md`  
**Input**: 결제 완료(PAID)된 주문을 기반으로 타임캡슐을 자동 생성하는 기능

## Summary
- 결제 승인 시점에 주문 옵션/상품 제약을 검증하고, 주문당 1개의 타임캡슐을 자동 생성한다.
- 상품 제약(media_types, max_media_count)과 주문 인원(headcount), 열람 시점(time_option/custom_open_at)을 캡슐 초기값에 반영한다.
- 중복 생성 방지(아이템포턴시)와 오류 로깅을 포함한다.

## Technical Context
- **Language/Framework**: TypeScript + NestJS, TypeORM, PostgreSQL
- **Existing modules**: `payments.service.ts`(결제 승인), `orders.service.ts`, `capsules.service.ts`, `order.entity.ts`, `capsule.entity.ts`, `product.entity.ts`
- **Auth**: JWT (주문자 기준)
- **Testing**: Jest + e2e(선택), Playwright 일부 참조

## Plan / Steps
1) **데이터 모델 연계**
   - `capsules`에 `order_id`(uuid, unique) 컬럼 추가 및 `@ManyToOne`/`@OneToOne` 관계 설정으로 주문-캡슐 연결.
   - 인덱스/unique 제약으로 주문당 1캡슐 보장; 기존 캡슐 생성 경로 영향 없는지 확인.
2) **도메인 유스케이스 추가**
   - `CapsulesService` 또는 별도 유즈케이스에 `createFromPaidOrder(orderId: string)` 추가.
   - 검증: 주문 상태 `PAID` 확인, 기존 캡슐 존재 시 재사용, 상품 활성/타입 검증, headcount 범위(1~10), media 제약(photo_count ≤ max_media_count 등), `CUSTOM` 시 `custom_open_at` 필수.
   - 생성 필드: `userId`, `productId`, `orderId`, `openAt` 계산, `viewLimit=headcount`, `viewCount=0`, `isLocked=true`, `title` 기본값, 콘텐츠/미디어 필드는 null/빈값.
   - 트랜잭션 또는 낙관적 체크로 동시 승인 시 중복 생성 방지.
3) **결제 승인 훅 연결**
   - `PaymentsService.approve`(또는 주문 상태를 PAID로 바꾸는 지점)에서 유즈케이스 호출.
   - 응답 DTO에 `capsuleId` 포함(이미 생성된 경우 재사용 ID 반환).
   - 실패 시 도메인 오류(404 상품 비활성/타입 불일치, 422 옵션 불일치, 409 중복) 처리 및 로깅.
4) **조회/노출 정합성**
   - 주문 조회 응답에 `capsuleId`를 선택적으로 포함하여 클라이언트가 생성 여부 확인 가능하게 함(필요 시).
   - Swagger 문서에 캡슐 ID 필드/에러 케이스 추가.
5) **테스트**
   - 단위: `createFromPaidOrder` 성공/중복/상품 비활성/타입 불일치/옵션 불일치/커스텀 시각 누락.
   - 통합: 결제 승인 플로우가 `capsuleId`를 반환하고 중복 생성하지 않는지 검증.
   - (옵션) Playwright/E2E는 후속 범위.

## Scope / Out of Scope
- 포함: 주문→캡슐 자동 생성, 도메인 검증, 응답에 캡슐 ID 노출, 로깅.
- 제외: 캡슐 편집/미디어 업로드 UX 변경, 결제 프로바이더 연동 방식 변경, 주문/상품 CRUD 확장.

## Risks / Checks
- 동시 결제 승인 시 중복 생성 가능성 → unique 제약 + 트랜잭션/재조회 처리.
- 기존 캡슐 생성 경로와의 충돌 → `order_id` optional 처리 및 기존 경로 영향 회피.
- 주문 옵션과 상품 제약 불일치 시 에러 코드 합의 필요(422/409 등) → API 설계 시 명시.

