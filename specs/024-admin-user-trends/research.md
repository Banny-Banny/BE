# Research - Admin User Join/Withdraw Trends

## Questions

1. 사용자 탈퇴 시점은 어떤 컬럼을 기준으로 집계해야 하는가?
2. 서버 시간대와 날짜 경계는 어떻게 계산되는가?
3. 기존 admin dashboard 모듈의 인증/인가 방식은 무엇인가?

## Findings

- `users`는 Soft Delete 패턴을 사용하므로 탈퇴 시점은 `deletedAt` 컬럼을 기준으로 집계하는 것이 일관성 있다.
- 서버는 KST 기준으로 운영되는 것으로 가정하고, 날짜 경계는 `DATE_TRUNC('day', ...)` 혹은 `::date` 캐스팅으로 처리한다.
- admin dashboard는 기존에 `AdminGuard` 또는 유사한 인증 가드를 통해 보호된다. (실제 코드는 구현 단계에서 확인)

## Decisions

- 가입일은 `createdAt`, 탈퇴일은 `deletedAt`을 기준으로 집계한다.
- 기간 계산은 서버 로컬 시간대 기준으로 오늘 포함 90일을 계산한다.
- 응답은 프론트에서 바로 map 처리 가능한 배열 형태로 제공한다.
