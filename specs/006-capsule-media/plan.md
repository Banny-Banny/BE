# 구현 계획: 캡슐 생성 멀티미디어 & S3 연동

## 1) 요구사항 확정
- 지원 타입: TEXT(본문/블록), IMAGE(jpeg/png/webp), VIDEO(mp4), AUDIO(mpeg/aac).
- 용량 제한: IMAGE ≤ 5MB, VIDEO ≤ 200MB, AUDIO ≤ 20MB(제안).
- 텍스트: 블록 최대 5개, 각 500자, 제목 100자. 총 글자수 2,000자 이내(제안).
- 개수 제한: 상품 max_media_count 우선, 기본 3개. TEXT 블록은 별도 제한(위 조건).
- 응답 포맷: `media_items[{media_id,type,url?}]`, `text_blocks[{order,content}]`. 구 `media_urls/types`는 호환용으로 유지하며 추후 Deprecate 표기.

## 2) 스키마/엔티티
- `MediaType` enum에 AUDIO 추가.
- `Media` 엔티티: AUDIO 지원(기존 durationMs 활용).
- `Capsule` 저장 구조:
  - media: 기존 배열 필드 유지 + 저장 시 Media 참조를 조회해 id/type/object_key를 기반으로 fill.
  - text_blocks: JSON 컬럼 추가(배열 {order, content}).
  - content 필드는 호환을 위해 유지.
  - view_limit/slot/위치/친구 정책은 변경 없음.

## 3) API/DTO 변경
- `POST /media/presign`: type AUDIO 허용, content_type 검증 확대.
- `POST /media/complete`: AUDIO 메타(duration_ms) 허용.
- `POST /capsule`:
  - 입력: title, open_at, view_limit, product_id, latitude/longitude 기존 유지.
  - media_ids: Media id 배열(소유자 검증, 최대 max_media_count).
  - text_blocks: {order, content} 배열(검증: 개수/길이/중복 order).
  - content/media_urls/media_types는 호환 필드로 optional 처리.
  - 검증: media 소유권, 타입 whitelist, 개수 제한, open_at 미래 시각, view_limit ≥ 0.
- `GET /capsule/:id` & 목록:
  - media 응답을 id/type/url 형태로 확장. url은 signed URL on-demand 또는 object_key를 리턴(결정: 목록은 object_key/원본 URL 없이, 상세는 서명 URL 포함).
  - text_blocks 포함.

## 4) 서비스 로직
- MediaService:
  - validateFile에 AUDIO 추가, 용량/컨텐츠타입 검증.
  - resolveMediaType에 AUDIO 추가.
  - presign/complete 기존 로직 재사용.
- CapsulesService:
  - create 시 media_ids 조회 후 소유권/타입 검증, product 제한 검사.
  - text_blocks 검증 및 저장.
  - 응답 변환 시 media_items/text_blocks 포함. (구 필드도 유지)
  - findOne/findNearby: media 변환 로직 추가.

## 5) Swagger/문서/테스트
- Swagger DTO/예제 업데이트 (AUDIO, media_ids, text_blocks).
- 테스트:
  - Media presign/complete AUDIO 케이스.
  - Capsule create: (a) media_ids만, (b) text_blocks만, (c) 혼합, (d) 제한 초과 에러.
  - Capsule 조회: media_items/text_blocks 노출 확인.

## 6) 환경 변수/운영
- 기존 S3 env 사용. AUDIO 별도 env 불필요.
- KMS 옵션 유지. 만료 TTL 기존 값 사용.

## 7) 단계적 적용 전략
- 1단계: AUDIO 지원 + media_ids 기반 캡슐 생성/조회 확장, 구 필드 유지.
- 2단계(선택): 구 `media_urls/types` Deprecate 후 제거 일정 공지.

