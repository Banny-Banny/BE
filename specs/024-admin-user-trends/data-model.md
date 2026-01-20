# Data Model - Admin User Join/Withdraw Trends

## Entities

### User

- `id`: PK
- `createdAt`: 가입 일시
- `deletedAt`: 탈퇴(soft delete) 일시, nullable

## Derived Fields

- `joinedDate`: `createdAt`의 날짜 부분 (YYYY-MM-DD)
- `withdrawnDate`: `deletedAt`의 날짜 부분 (YYYY-MM-DD)

## Aggregations

- `joined` = `COUNT(*)` GROUP BY `DATE(createdAt)`
- `withdrawn` = `COUNT(*)` GROUP BY `DATE(deletedAt)` WHERE `deletedAt IS NOT NULL`
