# Implementation Plan: 공지사항(Notice) CRUD + 상단 고정

## Architecture / Approach

- `Notice` 엔티티 및 마이그레이션 추가 (`notices` 테이블)
- 사용자용 `NoticesModule`에서 목록/상세 조회 제공
- 관리자용 `AdminNoticesController`에서 생성/수정/삭제 제공
- 상단 고정/노출 여부 기반 정렬 및 필터링 적용

## Data Model Changes

- 신규 테이블 `notices`
  - `id` (uuid PK)
  - `title` (varchar)
  - `content` (text)
  - `image_url` (text, nullable)
  - `is_pinned` (boolean, default false)
  - `is_visible` (boolean, default true)
  - `created_at`, `updated_at`, `deleted_at`

## API Surface

- `POST /admin/notices`
- `PATCH /admin/notices/:id`
- `DELETE /admin/notices/:id`
- `GET /notices`
- `GET /notices/:id`

## Security / Permissions

- 관리자용 API는 `AdminJwtAuthGuard` 적용
- 사용자용 API는 공개(비노출/삭제 공지는 조회 불가)

## Risks & Mitigations

- 상단 고정 과다: 리스트 정렬 기준을 `is_pinned DESC, created_at DESC`로 고정
- 검색 성능 저하: 제목/본문 ILIKE 검색 및 기본 인덱스 추가
