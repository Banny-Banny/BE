# Quickstart - Admin User Trends API

## Endpoint

`GET /api/admin/dashboard/user-trends?period=90d`

## Response Example

```json
[
  { "date": "2024-01-14", "joined": 12, "withdrawn": 0 },
  { "date": "2024-01-15", "joined": 25, "withdrawn": 2 }
]
```

## Notes

- 관리자 인증 필요
- 날짜가 없는 구간도 0으로 채워서 반환
