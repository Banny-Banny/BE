# Plan: 미디어 업로드(S3 연동) - 이미지/영상

## 1. 목표
- 프리사인 URL 기반으로 이미지/영상(mp4) 업로드를 지원하고 메타를 저장한다.
- 버킷 퍼블릭 차단 상태에서 서명 URL로만 접근하게 한다.

## 2. 인풋 & 의존성
- AWS S3 버킷 (퍼블릭 차단, SSE-S3 또는 KMS)
- NestJS 서비스: AWS SDK v3 (@aws-sdk/client-s3, @aws-sdk/s3-request-presigner)
- 인증: Bearer JWT
- DB: media 테이블(신규)

## 3. 범위
- 포함: presign, complete, signed-url 조회 API; 타입/사이즈 검증; DB 메타 저장
- 제외: 썸네일/트랜스코딩, 바이러스 스캔, CDN 튜닝

## 4. 설계 결정 (초안)
- Endpoint:
  - POST /api/media/presign
  - POST /api/media/complete
  - GET  /api/media/:id/url
- 파일 규격:
  - 이미지: jpeg/png/webp, ≤ 5MB
  - 영상: mp4, ≤ 200MB
- 키 규칙: `media/{userId}/{type}/{uuid}.{ext}`
- presign 만료: 10분 이내
- 암호화: SSE-S3 기본(옵션으로 KMS 키 설정 가능)
- DB: media(id, user_id, object_key, type, content_type, size, duration_ms?, width?, height?, created_at)

## 5. 데이터 모델 영향 (제안)
- `media` 테이블 신규 생성
- Enum: MediaType { IMAGE, VIDEO }

## 6. API 설계 (초안)
- POST /api/media/presign
  - Body: { type, filename, content_type, size }
  - Res: { upload_url, object_key, content_type, expires_in }
- POST /api/media/complete
  - Body: { object_key, content_type, size, duration_ms?, width?, height? }
  - Res: { media_id, object_key, url?, type, size, content_type }
- GET /api/media/:id/url
  - Res: { url, expires_in }

## 7. 비즈니스 규칙/검증
- 인증 필수
- 타입 화이트리스트, 크기 제한
- presign 시 content-type/size 검증
- complete 시 owner(userId)와 object_key 매핑 저장
- signed-url 생성 시 소유자 검증

## 8. 에러 코드 가이드
- 400: 타입/사이즈/파라미터 검증 실패
- 401: 인증 실패
- 404: media_id 또는 object_key 없음/권한 없음
- 502/503: S3 연동 실패

## 9. 테스트 전략
- 201 presign → PUT 업로드 → 201 complete 플로우
- 타입/사이즈 위반 400
- 소유자 아닌 사용자가 URL 요청 시 404/403
- presign 만료 후 업로드 실패 케이스

