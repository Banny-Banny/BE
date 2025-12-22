# Tasks: 주문/상품 조회 API

1. `GetOrderParamDto` 추가 (uuid 검증).
2. `OrdersController`에 `GET /orders/:id` 라우트 추가, Swagger 문서 작성.
3. `OrdersService.findOne` 구현: 주문 조회, 소유권 검사, 상품 활성/타입 검증, 응답 매핑.
4. 응답 모델 정리: 주문 필드 + 상품 제약 필드 포함.
5. 테스트 추가: 200 정상, 403 소유권, 404 주문 없음, 404 상품 비활성/타입 불일치.

