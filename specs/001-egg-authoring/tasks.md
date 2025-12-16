# Tasks: 이스터에그 작성 API

## Phase 1: Setup & Migrations
- [ ] T001 Add user slots column `egg_slots int default 3` (migration) in `src/database/migrations/`
- [ ] T002 Add capsules media arrays `media_urls text[]`, `media_types enum[]`, CHECK length<=3 (migration)
- [ ] T003 Ensure product enum/ProductType & CHECK (EASTER_EGG → max_media_count 0~3) reflected in migration
- [ ] T004 Sync TypeORM config to include new migrations if needed (`src/database/database.module.ts`)

## Phase 2: Domain & Validation
- [ ] T005 Update `capsule.entity.ts` to store media_urls/media_types arrays (nullable, length<=3)
- [ ] T006 Add DTO `CreateCapsuleDto` with validations (title/content <=500, media len 0~3, type/url matching, open_at future, view_limit>=0)
- [ ] T007 Add slot logic helper (check/decrement egg_slots) in service layer (users repo)
- [ ] T008 Add product policy check (EASTER_EGG → max_media_count, allowed mediaTypes)

## Phase 3: Service & Controller
- [ ] T009 Create `CapsulesService` (transaction: check slots→decrement→create capsule; product validations; is_locked/open_at logic)
- [ ] T010 Create `CapsulesController` POST `/api/capsules` with JWT guard, Swagger docs
- [ ] T011 Wire module: `CapsulesModule` + import in `app.module.ts`

## Phase 4: Tests (e2e/integ)
- [ ] T012 e2e: 슬롯 부족 시 409
- [ ] T013 e2e: open_at 과거 400
- [ ] T014 e2e: media_types!=TEXT인데 대응 url 없음 → 400
- [ ] T015 e2e: product EASTER_EGG, max_media_count 초과 → 400
- [ ] T016 e2e: 정상 201, DB에 media 배열 저장, egg_slots 1 감소 확인

## Phase 5: Polish
- [ ] T017 Swagger schema examples for media arrays, slots error (409)
- [ ] T018 Readme/AGENTS 업데이트 여부 검토 (선택)

