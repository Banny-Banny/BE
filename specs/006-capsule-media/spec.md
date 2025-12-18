# 캡슐 생성 시 멀티미디어 업로드 & S3 연동 기능 명세

## 목표
- 캡슐 생성 시 이미지·영상·음악·텍스트를 한 번에 구성할 수 있게 하고, 미디어 파일은 S3에 안전하게 업로드/관리한다.
- 기존 친구/위치/뷰제한 정책은 유지하면서 업로드·연동 플로우만 확장한다.

## 현행 요약
- `POST /capsule`은 `media_urls`, `media_types` 배열을 받아 최대 3개 미디어만 TEXT/IMAGE/VIDEO로 저장.
- 미디어 업로드는 별도 `POST /media/presign` → S3 업로드 → `POST /media/complete` 로 Media 레코드를 생성하고, `GET /media/:id/url`로 서명 URL을 발급.
- 미디어 타입 검증은 `MediaService`에서 IMAGE/VIDEO만 처리하며, 용량 제한(이미지 5MB, 비디오 200MB) 적용.

## 기능 분기점
1) **지원 타입 확장**
   - IMAGE, VIDEO 외에 AUDIO(예: audio/mpeg, audio/aac) 추가. TEXT는 본문/블록 형태로 함께 전송 가능.
2) **업로드 플로우**
   - Presign: 업로드 타입(IMAGE/VIDEO/AUDIO), 파일 메타(이름, 크기, content_type)를 받아 S3 PutObject presign 발급.
   - Complete: object_key·content_type·size(+옵션 duration/width/height)를 받아 Media 레코드 생성. AUDIO 메타 지원(duration_ms).
   - Capsule Create: media_ids 배열(등록된 Media) + text_blocks(순서/내용)로 캡슐 생성 요청.
3) **검증·정책**
   - 파일 타입/확장자 화이트리스트: IMAGE(jpeg/png/webp), VIDEO(mp4), AUDIO(mpeg/aac). 최대 용량: 이미지 5MB, 비디오 200MB, 오디오 TBD(예: 20MB) — 결정 필요.
   - 개수 제한: 상품/기본 정책에 따라 max_media_count(기본 3) 적용, TEXT 블록은 별도 제한(예: 최대 5개, 각 500자) 결정 필요.
   - 미디어 소유권: capsule 생성 시 media_ids는 요청 사용자 소유만 허용.
4) **저장 구조**
   - Capsule에 media 참조 방식 정의: (A) 기존 media_urls/types 유지하면서 Media.id로부터 URL/Type을 해석하거나 (B) Media.id 배열 + text_blocks 병행 필드 추가. (호환 전략 선택 필요)
   - Media에 AUDIO 타입 추가, duration_ms 필드 재사용.
5) **응답 포맷**
   - Capsule 응답에서 media 목록을 `{ media_id, type, url? }`로 통일, TEXT 블록은 `{ order, content }`.
   - S3 서명 URL 만료 정보(expires_in) 유지.
6) **권한·보안**
   - JWT 보호는 현행 유지. Presign/Complete/Capsule Create 모두 인증 필요.
   - S3 객체 키는 사용자별 prefix 유지, SSE-KMS 옵션은 env 기반 그대로 사용.
7) **마이그레이션/호환**
   - 기존 캡슐의 media_urls/types 응답 유지 여부 결정: (A) 구 필드 deprecated 표시, (B) 완전 교체. 클라이언트 호환 전략 필요.
8) **오류 코드**
   - 신규: `UNSUPPORTED_MEDIA_TYPE`, `AUDIO_SIZE_EXCEEDED`, `MEDIA_OWNERSHIP_MISMATCH`, `MEDIA_COUNT_EXCEEDED`.

## API 영향도 (초안)
- `POST /media/presign`: type에 AUDIO 추가, content_type/audio 검증, 응답 동일.
- `POST /media/complete`: AUDIO 메타(duration_ms) 허용, 저장 시 type=AUDIO.
- `POST /capsule`: 요청 스키마를 `media_ids[]` + `text_blocks[]` 중심으로 개편, 개수/소유권 검증 추가.
- `GET /capsule/:id`: media 응답을 id/type/url 형태로 확장하고 text_blocks 포함.

## 결정 필요 항목 (질문)
- AUDIO 용량 상한 및 허용 MIME 목록 확정?
- Capsule 저장 구조: 기존 `media_urls/types` 유지 vs 신규 `media_items`/`text_blocks` 병행?
- TEXT 블록 최대 개수/길이, 전체 글자수 제한 500자 제목 100자
- 클라이언트 호환 기간 동안 구 필드 유지 여부와 종료 시점?

## 환경 변수/운영
- S3_BUCKET, S3_UPLOAD_PREFIX, S3_PRESIGN_TTL, S3_SIGNED_URL_TTL, AWS_REGION, S3_KMS_KEY_ID 현행 유지. AUDIO 도입 시 별도 처리 불필요.

## 릴리스 체크리스트
- Swagger 스키마 업데이트 (media/audio/text 스펙 반영).
- 단위/통합 테스트: Presign/Complete 오디오 케이스, 캡슐 생성/조회 멀티미디어 케이스 추가.
- 마이그레이션/기존 응답 호환성 확인 후 배포 공지.

