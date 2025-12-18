# Tasks: 미디어 업로드(S3 연동)

## Phase 1: 모델/인프라
- [ ] T001 media 엔티티/마이그레이션 추가 (id, user_id, object_key, type, content_type, size, duration_ms?, width?, height?, created_at)
- [ ] T002 MediaType enum 정의 (IMAGE, VIDEO)

## Phase 2: 서비스 로직
- [ ] T003 S3 클라이언트/프리사인 유틸 구성 (@aws-sdk/client-s3, @aws-sdk/s3-request-presigner)
- [ ] T004 presign 서비스: 타입/사이즈/확장자 검증, key 생성, 만료 10분 이하 URL 발급
- [ ] T005 complete 서비스: object_key/owner 매핑 저장, 메타(크기/타입/옵션 duration) 기록
- [ ] T006 signed-url 조회: media 소유자 확인 후 서명 URL 반환

## Phase 3: 컨트롤러/API
- [ ] T007 POST /api/media/presign 엔드포인트 구현 + DTO 검증
- [ ] T008 POST /api/media/complete 엔드포인트 구현 + DTO 검증
- [ ] T009 GET /api/media/:id/url 엔드포인트 구현

## Phase 4: 검증/보안
- [ ] T010 파일 타입/사이즈 화이트리스트 검증 함수/유틸
- [ ] T011 presign 응답에 만료시간/콘텐츠타입/키 포함
- [ ] T012 KMS/SSE-S3 설정값 읽어 암호화 헤더 옵션 처리(필요 시)

## Phase 5: 테스트
- [ ] T013 happy path: presign → PUT 업로드 → complete → signed-url 성공
- [ ] T014 invalid type/size 400
- [ ] T015 소유자 아닌 사용자 URL 요청 시 차단

