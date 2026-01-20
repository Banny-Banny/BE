# Research - Admin Products Basic CRUD

## Findings

- `Product` 엔티티는 결제/캡슐 로직에서 사용되므로 기존 컬럼 유지가 중요함.
- Admin 모듈은 `AdminJwtAuthGuard` + `ApiBearerAuth` 패턴을 사용한다.
- Soft delete는 `DeleteDateColumn`과 `repository.softRemove()` 패턴으로 구현되어 있다.

## Decisions

- 관리자 CRUD는 `admin/products` 경로로 추가한다.
- 목록 조회는 `withDeleted()`로 조회 후 상태 필터로 구분한다.
- 상품 타입이 `EASTER_EGG`인 경우 `max_media_count` 값이 필요하다.
