# Implementation Plan: Capsule Entry & Fetch API

**Branch**: `010-capsule-entry` | **Date**: 2025-12-26 | **Spec**: `specs/010-capsule-entry/spec.md`  
**Input**: 결제 완료(PAID)된 캡슐에서 슬롯별 글/미디어 작성 및 조회, 참여자별 슬롯 리스트 제공

## Summary
- 캡슐 조회: 결제 완료된 주문에 연결된 캡슐만 조회 허용, 참여 인원(headcount)만큼 슬롯을 반환하고 각 슬롯의 작성자/작성 여부/작성 시각/콘텐츠(텍스트+미디어)를 제공한다.
- 글 작성: 사용자는 본인 슬롯(최초 작성 시 배정된 슬롯)에서만 1회 글 작성 및 미디어 첨부 가능, 타인 슬롯 수정/작성은 차단한다.
- 미디어 제약: S3 presign 기준(이미지 5MB jpeg/png/webp, 영상 200MB mp4, 오디오 20MB mp3/mp4/m4a/aac)을 검증한다.
- 감사 로그: 캡슐 조회/작성 시 `capsule_access_logs`에 기록한다.

## Technical Context
- NestJS + TypeORM + PostgreSQL, JWT 인증.
- 관련 모듈: `capsules.controller/service`, `media.service`(S3 presign/complete), `orders`, `payments`(결제 상태), `auth`.
- 데이터: `capsules`(orderId, productId, media 목록), `orders.headcount`, `capsule_access_logs`.
- 미디어 허용 타입/크기: 이미지 jpeg/png/webp ≤5MB, 영상 mp4 ≤200MB, 오디오 mp3/mp4/x-m4a/aac ≤20MB (`media.service`).

## Plan / Steps
1) **데이터 모델/마이그레이션**
   - 신규 테이블 `capsule_participant_slots`(id uuid, capsule_id fk, slot_index int, user_id uuid nullable, entry_id uuid nullable, assigned_at, created_at/updated_at).  
     - 제약: unique(capsule_id, slot_index), unique(capsule_id, user_id)로 동일 캡슐에서 1인 1슬롯 보장.
   - 신규 테이블 `capsule_entries`(id uuid, capsule_id fk, slot_id fk unique, user_id fk, content text, media_item_ids uuid[] nullable, media_types enum[] nullable, created_at/updated_at).  
     - 제약: unique(capsule_id, user_id)로 사용자 중복 작성 방지.
   - `capsules`와 headcount 연계: 슬롯 개수 = `orders.headcount` 기반으로 사전 생성 혹은 조회 시 lazy 생성(선택). 기본은 사전 생성 마이그레이션 + 서비스 로직에서 보정.
2) **권한/검증 흐름**
   - 캡슐 조회/작성 전: 캡슐 존재 확인, `order.status === PAID` 확인, 요청자 권한 확인(주문자 또는 슬롯에 배정된 사용자).
   - 슬롯 배정 정책: 주문자 또는 초대된 사용자가 최초 작성 시 빈 슬롯 하나에 자신을 할당 후 entry 생성, 이후 해당 슬롯/사용자 외에는 작성 불가.
   - 미디어 ID 소유자 검증: 첨부 media_ids가 요청자 소유인지 `media` 테이블로 확인.
3) **API 설계**
   - `GET /api/capsules/:capsuleId`: 캡슐 메타 + `slots: [{slot_id, slot_index, user_id, nickname, wrote_at, content, media_items[]}]`.  
     - headcount만큼 슬롯 반환(미작성 슬롯은 content=null, user=null).  
     - 403: 미결제 또는 권한 없음, 404: 캡슐 없음.
   - `POST /api/capsules/:capsuleId/entries`: 본인 슬롯에 텍스트/미디어 작성.  
     - 요청: content, media_item_ids(optional).  
     - 응답: entry_id, slot_id, wrote_at.  
     - 409/400: 이미 작성함, 슬롯 부족/배정 불가, 타인 슬롯 접근.
4) **서비스/도메인 로직**
   - `CapsulesService`에 `getCapsuleWithSlots(capsuleId, userId)`와 `createEntry(capsuleId, userId, payload)` 추가.  
   - 트랜잭션 처리: 슬롯 배정 + entry 생성 + unique 제약 동시 보장.  
   - 접근 로그 기록: 조회/작성 시 `capsule_access_logs`에 삽입.
5) **DTO/Validation**
   - 요청 DTO: `CreateCapsuleEntryDto { content: string; media_item_ids?: string[] }` + class-validator 제한(본문 길이 TBD, media ids length <= product.max_media_count? headcount?).  
   - 응답 DTO: 캡슐/슬롯/entry/미디어 메타 포함.
6) **테스트**
   - 단위: 슬롯 배정/중복 작성 차단, 미디어 소유 검증, 권한 검증, 미디어 타입/크기 제한 실패.  
   - 통합/e2e: PAID vs 미결제, 작성 후 재작성 차단, 슬롯 가득 찬 상태에서 추가 요청 차단, 조회 시 슬롯/작성 정보 노출.
7) **문서/Swagger**
   - 신규 엔드포인트, 응답 스키마, 에러 코드(403/404/409/400) 명시.

## Scope / Out of Scope
- 포함: 캡슐 조회/작성, 슬롯 배정, 미디어 제약 검증, 접근 로그.
- 제외: 초대/슬롯 사전 배정 UI/링크 발급, 알림/푸시, 실시간 동기화, 캡슐 공개 범위 변경.

## Risks / Checks
- 동시 작성 시 슬롯/엔트리 중복 → unique 제약 + 트랜잭션으로 방지, 충돌 시 409 반환.
- headcount와 슬롯 수 불일치 → 초기화 로직에서 보정 필요(사전 생성 or 조회 시 생성) 및 모니터링.
- 미디어 소유권 미검증 시 타인 리소스 오용 → media_id 소유 확인 필수.

