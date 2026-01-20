# Implementation Plan - Admin Products Basic CRUD

## Overview

관리자 전용 상품 CRUD를 추가한다. 기존 `products` 엔티티에 관리자 관리용 필드(썸네일, 카테고리, 수정/삭제일)를 확장하고, 관리자 모듈에 컨트롤러/서비스/DTO를 구현한다.

## Phase 0 - Research

- 기존 `Product` 엔티티와 주문/캡슐 연관 로직 확인
- Soft delete 컬럼/쿼리 패턴 (Admin Users/Notices) 재사용

## Phase 1 - Design

- DTO 설계: 생성/수정/리스트 쿼리
- 리스트 쿼리 필터: `search`, `categoryId`, `status`
- 응답 포맷: `{ success: true, data: ... }` 기존 패턴 일치

## Phase 2 - Implementation

1. `Product` 엔티티 필드 확장 및 마이그레이션 추가
2. `AdminProductsService` 구현 (CRUD/리스트)
3. `AdminProductsController` 구현 및 Swagger 문서화
4. `AdminModule`에 Product 리포지토리 및 컨트롤러/서비스 등록

## Phase 3 - Validation

- 생성/수정/삭제 API 정상 동작 확인
- 리스트 필터/검색/페이지네이션 확인
- soft delete된 데이터 조회 동작 확인

## Artifacts

- `specs/025-admin-products-basic-crud/contracts/api-spec.json`
- `specs/025-admin-products-basic-crud/quickstart.md`
