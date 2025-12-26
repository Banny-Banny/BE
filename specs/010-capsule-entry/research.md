# Research Notes: Capsule Entry & Fetch

## Open Questions / Clarifications
- 슬롯 생성 시점: 캡슐 생성 시 headcount만큼 사전 생성 vs 조회/작성 시 lazy 생성? (기본 제안: 사전 생성, 없으면 조회 시 보정)
- 슬롯 배정 정책: 주문자 외 참여자 식별/초대 방식(링크/수동 등록) 미정. 현재는 “최초 작성한 사용자”를 슬롯 소유자로 고정하는 방식으로 가정.
- 본문 길이 제한: content max 길이(예: 2000자?) 미정.
- 미디어 개수 제한: 상품 옵션/헤드카운트에 따른 총 첨부 개수 제한 필요 여부.
- 에러 코드 합의: 중복 작성/슬롯 없음/권한 없음 → 400 vs 403 vs 409 구체 코드 정리 필요.

## References
- S3 presign 제약: `media.service.ts` (이미지 5MB jpeg/png/webp, 영상 200MB mp4, 오디오 20MB mp3/mp4/x-m4a/aac).
- headcount/옵션: `orders.headcount`, `orders.photo_count`, `orders.add_music`, `orders.add_video`.
- 캡슐 엔티티: `capsules`에 media_urls/media_item_ids/media_types/text_blocks, orderId unique.

## Proposed Defaults
- 슬롯 생성: 캡슐 생성 시 headcount만큼 생성. 기존 캡슐에 슬롯 없을 경우 조회 시 보정 생성.
- 슬롯 배정: 작성 시 빈 슬롯 선택 후 `user_id` 할당+잠금. 동일 사용자 추가 작성 시 409.
- 본문 길이: 2000자 제한 제안.
- 미디어 개수: 최대 3개(서비스 기본) 또는 상품 옵션에 맞춰 서버에서 검증(미정 시 3개 제한 적용).

