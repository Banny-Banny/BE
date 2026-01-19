# Implementation Plan: 1:1 문의 (Inquiry - Chat)

## Architecture / Approach

- `CustomerService`를 채팅방 메타데이터로 확장하고 `CustomerServiceMessage` 테이블 추가
- 관리자 HTTP API는 `/admin/inquiries` 아래로 구성
- 실시간 채팅은 WebSocket namespace `/admin-chat`, `/user-chat`로 분리
- WebSocket 인증은 관리자 JWT와 사용자 JWT를 각각 검증

## Data Model Changes

- `customer_services`:
  - `status` (PENDING | IN_PROGRESS | ON_HOLD | COMPLETED)
  - `last_message_at`, `last_message_preview`, `deleted_at`
- `customer_service_messages` (신규):
  - `id`, `customer_service_id`, `sender_type`, `sender_user_id`, `sender_admin_id`
  - `content`, `is_read_by_admin`, `is_read_by_user`, `created_at`, `updated_at`, `deleted_at`

## API Surface

- `GET /admin/inquiries` (리스트/필터/정렬)
- `GET /admin/inquiries/:id` (메시지 이력 페이지네이션)
- `PATCH /admin/inquiries/:id/status`
- `DELETE /admin/inquiries/:id`
- `DELETE /admin/inquiries/:id/messages/:messageId`
- `PUT /admin/inquiries/:id/messages/:messageId`

## WebSocket Events

Namespace `/admin-chat`, `/user-chat`

- `join_room`
- `leave_room`
- `send_message`
- `receive_message`
- `read_alert`

## Security / Permissions

- 관리자: `AdminJwtAuthGuard` (HTTP), JWT 검증 후 WebSocket 연결
- 유저: `JwtAuthGuard` (HTTP 미사용), JWT 검증 후 WebSocket 연결
- 메시지 수정은 관리자 본인 메시지만 허용

## Risks & Mitigations

- 실시간 메시지 분실: DB 저장 후 브로드캐스트
- 읽음 처리 오차: `read_alert` 기준으로 서버에서 상태 갱신
- 멀티 세션: room 기반 브로드캐스트로 동기화
