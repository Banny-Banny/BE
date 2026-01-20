# Quickstart - Admin Products Basic CRUD

## Endpoints

- `POST /api/admin/products`
- `GET /api/admin/products`
- `GET /api/admin/products/:id`
- `PATCH /api/admin/products/:id`
- `DELETE /api/admin/products/:id`

## Create Example

```json
{
  "name": "100년 타임캡슐",
  "price": 9900,
  "description": "100년 뒤에 열리는 타임캡슐",
  "thumbnailUrl": "https://cdn.example.com/products/capsule.png",
  "categoryId": "b3f1df7b-6b13-4bf5-b0f8-0f8c3a1b0a01",
  "isActive": true,
  "productType": "TIME_CAPSULE"
}
```

## List Example

`GET /api/admin/products?limit=20&offset=0&search=타임캡슐&status=ACTIVE`

## Notes

- 관리자 인증 필요
- 삭제는 soft delete로 처리
