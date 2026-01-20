# Data Model - Admin Products Basic CRUD

## Products (기존 테이블 확장)

| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| id | uuid | 상품 ID |
| name | varchar(50) | 상품명 |
| price | int | 판매 가격 |
| description | text | 상품 설명 (nullable) |
| thumbnail_url | text | 썸네일 URL (nullable) |
| category_id | uuid | 카테고리 ID (nullable) |
| product_type | enum | 상품 유형 |
| media_types | enum[] | 허용 미디어 타입 (nullable) |
| max_media_count | int | 업로드 최대 개수 (nullable) |
| is_active | boolean | 판매/노출 상태 |
| created_at | timestamp | 생성일 |
| updated_at | timestamp | 수정일 |
| deleted_at | timestamp | 삭제일(soft delete) |

## Indexes

- `idx_products_category_id` (`category_id`)
- `idx_products_is_active` (`is_active`)
- `idx_products_deleted_at` (`deleted_at`)
