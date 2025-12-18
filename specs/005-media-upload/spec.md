# Feature: 미디어 업로드(S3 연동) - 이미지/영상

## 개요
- 이미지(사진)와 영상(mp4)을 S3에 저장하고, 서버는 업로드용 프리사인 URL 발급 및 업로드 메타 등록을 담당한다.
- S3는 비공개 버킷으로 두고, 접근은 프리사인 URL 또는 서버가 생성하는 서명 URL로 제한한다.

## 목표
- 클라이언트가 업로드 가능한 프리사인 URL을 발급받고, 업로드 완료 후 서버에 메타/키를 등록하여 추후 조회·사용할 수 있게 한다.
- 이미지/영상 파일 타입과 크기를 서버에서 검증하고, 버킷 정책/퍼블릭 차단을 유지한다.

## 비범위
- 썸네일/트랜스코딩 처리(향후 별도 파이프라인).
- 콘텐츠 검사(바이러스/안전성), CDN 캐시 정책 세부 튜닝.

## 이해관계자 및 액터
- Authenticated User (업로드 주체)
- System (프리사인 URL 발급, 메타 저장, 조회 시 서명 URL 생성)

## 사용자 시나리오
1. 사용자가 업로드할 파일 정보를 선택한다(이미지 또는 mp4).
2. 클라이언트가 서버에 업로드 요청을 보내 프리사인 URL을 받는다.
3. 클라이언트가 프리사인 URL로 S3에 직접 업로드한다.
4. 업로드 완료 후, 서버에 업로드 완료 콜백/메타 등록을 호출하여 key와 메타정보를 저장한다.
5. 필요한 경우 서버가 서명 URL을 생성해 최종 접근 URL로 제공한다.

## 기능 요구사항 (테스트 가능)
1. **인증 필수**: Bearer JWT 없으면 401.
2. **파일 타입 검증**:
   - 이미지: `image/jpeg`, `image/png`, `image/webp`
   - 영상: `video/mp4`
3. **파일 크기 제한**:
   - 이미지: 최대 5MB
   - 영상: 최대 200MB
4. **경로 규칙**: `media/{userId}/{type}/{uuid}.{ext}` 로 객체 key 생성.
5. **스토리지 정책**:
   - 버킷 퍼블릭 액세스 차단 유지.
   - 기본 암호화 SSE-S3(또는 지정된 KMS 키) 적용.
6. **프리사인 URL 발급**:
   - 요청한 파일 타입/크기/확장자를 검증 후 유효기간 10분 이하 URL 발급.
   - 응답에 `upload_url`, `object_key`, `content_type`, `expires_in` 포함.
7. **메타 등록**:
   - 업로드 완료 후 `object_key`, `content_type`, `size`, `duration?(영상)` 등을 서버에 저장.
   - DB에 업로더(userId)와 소유권을 연결.
8. **다운로드 접근**:
   - 서버가 서명 URL(짧은 만료)을 발급해 반환하거나, 필요 시 프리사인 GET을 제공.
9. **에러 처리**:
   - 타입/사이즈 위반 시 400.
   - 인증 실패 401.
   - S3 연동 오류 시 502/503 로깅.

## API 초안
- `POST /api/media/presign`
  - Auth: Bearer JWT
  - Body: `{ type: "IMAGE" | "VIDEO", filename: string, content_type: string, size: number }`
  - 201: `{ upload_url, object_key, content_type, expires_in }`
- `POST /api/media/complete`
  - Auth: Bearer JWT
  - Body: `{ object_key, content_type, size, duration_ms?, width?, height? }`
  - 201: `{ media_id, object_key, url (signed or path), type, size, content_type }`
- `GET /api/media/:id/url`
  - Auth: Bearer JWT
  - 200: `{ url, expires_in }`

## 데이터 모델(초안)
- `media` 테이블(또는 컬렉션):
  - id (uuid), user_id, object_key, type(IMAGE/VIDEO), content_type, size, duration_ms?, width?, height?, created_at

## 성공 기준
- 지원 타입/크기 내 파일에 대해 presign → 업로드 → complete 흐름이 201로 성공.
- 잘못된 타입/크기/미인증 요청은 4xx로 거절.
- 업로드된 객체는 버킷 퍼블릭 차단 상태에서만 접근 가능하며, 서명 URL을 통해 접근이 가능하다.

