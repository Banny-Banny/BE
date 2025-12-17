# Tasks: 타임캡슐 주문(결제 전) 생성 및 금액 계산

## Phase 1: 설계/모델
- [ ] T001 orders 엔티티/마이그레이션: id, user_id, product_id, time_option enum, custom_open_at, headcount, photo_count, add_music, add_video, total_amount, status(PENDING_PAYMENT), timestamps
- [ ] T002 time_option/status enum 정의

## Phase 2: DTO/유효성
- [ ] T003 DTO: product_id(uuid), time_option(enum), custom_open_at(if CUSTOM, future), headcount(1~10), photo_count(0~headcount*5), add_music?(bool), add_video?(bool)

## Phase 3: Service/비즈니스 로직
- [ ] T004 product 조회/검증 (TIME_CAPSULE, is_active)
- [ ] T005 가격 계산: base(1000) + photo_count*500 + music(1000) + video(2000)
- [ ] T006 photo_count 제한: ≤ headcount*5
- [ ] T007 time_option CUSTOM 시 미래 시각 검증
- [ ] T008 주문 생성: status=PENDING_PAYMENT 저장, 결과 반환

## Phase 4: Controller/Swagger
- [ ] T009 POST /api/orders 엔드포인트 + Swagger 문서 (요청/응답 예시)

## Phase 5: 테스트
- [ ] T010 201 정상: music/video/photo 조합, 총액 검증
- [ ] T011 400: headcount 초과, photo_count 초과, custom_open_at 과거
- [ ] T012 404: product_id 미존재/비활성/타입 불일치

