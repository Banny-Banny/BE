# Implementation Plan: 주문/상품 조회 API

**Branch**: `007-order-product-fetch` | **Date**: 2025-12-19 | **Spec**: `specs/007-order-product-fetch/spec.md`  
**Input**: 주문 상세와 상품 제약을 조회하는 GET API 추가

## Summary
- 주문 ID로 조회해 주문 옵션(인원·사진 수·음악/영상)과 금액/상태를 반환하고, 연관 상품 제약(max_media_count, media_types 등)을 함께 내려 UI 복원을 지원한다.
- 소유권 검증(주문자만 접근)과 상품 활성/타입 검증을 포함한다.

## Technical Context
- **Language/Framework**: TypeScript + NestJS, TypeORM, PostgreSQL
+- **Existing modules**: `orders.controller.ts`, `orders.service.ts`, `product.entity.ts`, `order.entity.ts`
- **Auth**: JWT (`JwtAuthGuard` + `@CurrentUser`)
- **Testing**: Jest + existing e2e (tests/playwright may be out of scope)

## Plan / Steps
1) **DTO & Routing**
   - 추가: `GetOrderParamDto` (uuid)
   - `OrdersController`에 `GET /orders/:id` 엔드포인트 추가, Swagger 문서 및 응답 스키마 예시 작성.
2) **Service 로직**
   - `OrdersService.findOne(user, id)` 구현.
   - 검증: 주문 존재/삭제 여부, 소유권, 상품 존재 & `ProductType.TIME_CAPSULE` & `isActive`.
   - 반환: 주문 필드 + 상품 필드 요약.
3) **Response Shape**
   - `order`: `order_id`, `status`, `total_amount`, `time_option`, `custom_open_at?`, `headcount`, `photo_count`, `add_music`, `add_video`, `created_at`, `updated_at?`
   - `product`: `id`, `product_type`, `name`, `price`, `is_active`, `max_media_count`, `media_types`
4) **Swagger & Docs**
   - `@ApiOperation`, `@ApiResponse` 예시 추가.
5) **Tests**
   - 단위/통합: 소유권 403, 미존재 404, 상품 비활성/타입 불일치 404, 정상 200.

## Scope / Out of Scope
- 주문 생성/결제 로직 변경 없음.
- 상품 CRUD 추가 없음(조회만).

## Risks / Checks
- 기존 주문 상태 enum 영향 없음; 읽기-only.
- 대용량 영향 미미 (단건 조회).


