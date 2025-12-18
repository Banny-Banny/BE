# 태스크 목록: 캡슐 멀티미디어 & S3 연동

1) 스키마/enum 정비
   - [ ] `MediaType`에 AUDIO 추가, 공통 enum/Swagger 반영.
   - [ ] `Capsule` 엔티티에 `text_blocks` JSON 컬럼 추가(배열 {order, content}).
   - [ ] 마이그레이션 파일 생성(DB 반영).

2) Media 레이어 확장
   - [ ] `PresignMediaDto`에 AUDIO 허용(content_type whitelist, size ≤ 20MB).
   - [ ] `CompleteMediaDto`에 AUDIO duration_ms 허용.
   - [ ] `MediaService` 검증 로직에 AUDIO 추가(IMAGE 5MB/VIDEO 200MB/AUDIO 20MB).
   - [ ] Swagger 예제/응답 타입 갱신.

3) Capsule 생성/조회 확장
   - [ ] `CreateCapsuleDto`에 `media_ids[]`, `text_blocks[]` 추가, 검증 로직 작성(텍스트 블록 최대 5개·각 500자·제목 100자·총 2000자 제안).
   - [ ] `CapsulesService.create`에서 media 소유권/개수/product 제한 검증 후 media_items 구성, text_blocks 저장.
   - [ ] `findOne`/`findNearby` 응답에 `media_items`(id/type/optional signed_url)와 `text_blocks` 포함. 기존 media_urls/types는 호환 유지.

4) 컨트롤러/Swagger 반영
   - [ ] Capsules 컨트롤러 DTO/데코레이터 업데이트(Swagger schema 예제 포함).
   - [ ] Media 컨트롤러에 AUDIO 케이스 예제 추가.

5) 테스트
   - [ ] 유닛: MediaService AUDIO presign/complete 검증.
   - [ ] 유닛: CapsulesService media_ids + text_blocks 검증/정상 생성.
   - [ ] E2E/통합: 캡슐 생성→조회 플로우(서명 URL/텍스트 블록 확인).

6) 마이그레이션/배포
   - [ ] DB 마이그레이션 적용 검증.
   - [ ] 클라이언트 호환 가이드(구 media_urls/types deprecate 일정) 기록.

