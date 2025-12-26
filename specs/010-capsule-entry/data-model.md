# Data Model: Capsule Entry & Slots

## New Tables

### capsule_participant_slots
- `id` uuid PK
- `capsule_id` uuid FK -> capsules(id) ON DELETE CASCADE
- `slot_index` int NOT NULL (0..headcount-1), unique with `capsule_id`
- `user_id` uuid FK -> users(id) NULL (미배정 슬롯 허용), unique with `capsule_id` to enforce 1 user per capsule
- `assigned_at` timestamp NULL (user_id가 채워질 때 기록)
- `created_at`, `updated_at` timestamps

### capsule_entries
- `id` uuid PK
- `capsule_id` uuid FK -> capsules(id) ON DELETE CASCADE
- `slot_id` uuid FK -> capsule_participant_slots(id) UNIQUE (1:1)
- `user_id` uuid FK -> users(id)
- `content` text NOT NULL
- `media_item_ids` uuid[] NULL (media 테이블 id)
- `media_types` enum MediaType[] NULL (IMAGE/VIDEO/AUDIO/TEXT)
- `created_at`, `updated_at` timestamps

## Constraints / Rules
- slot uniqueness: unique(capsule_id, slot_index)
- per-capsule user uniqueness: unique(capsule_id, user_id) in slots and entries → 한 캡슐에 한 번만 작성/할당
- entry-slot uniqueness: unique(slot_id)
- media size/type: `media.service.ts` 제약 사용(이미지 ≤5MB jpeg/png/webp, 영상 ≤200MB mp4, 오디오 ≤20MB mp3/mp4/x-m4a/aac)
- headcount alignment: 슬롯 개수 = `orders.headcount`; 조회 시 부족 슬롯 자동 생성 보정 가능

## Impacts
- 서비스 로직: 작성 시 트랜잭션으로 슬롯 배정(user_id set) + entry 생성 + entry_id 업데이트.
- 조회 응답: 슬롯 리스트에 user/profile, wrote_at(entry.created_at), content, media 메타를 포함.
- 접근 제어: 요청자 user_id가 슬롯 user_id와 일치해야 작성/수정 가능; 미배정 슬롯은 최초 작성자에게 할당.

