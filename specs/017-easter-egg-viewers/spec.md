# 📝 [API] 이스터에그 발견자 기능 명세서

## 1. 개요

- **기능명**: 이스터에그 발견한 사람 저장 API, 이스터에그 발견한 사람 불러오기 API
- **기능 설명**: 사용자가 이스터에그를 발견했을 때 기록하고, 해당 이스터에그를 발견한 사람들의 목록을 조회하는 기능
- **관련 기획서/디자인**: -

---

## 2. API 엔드포인트

### 2-1. 이스터에그 발견 기록

| **항목** | **내용** |
| --- | --- |
| **Method** | `POST` |
| **URL Path** | `/api/capsules/:id/viewers` |
| **인증 필요 여부** | ✅ Yes (Bearer Token) |

### 2-2. 이스터에그 발견자 목록 조회

| **항목** | **내용** |
| --- | --- |
| **Method** | `GET` |
| **URL Path** | `/api/capsules/:id/viewers` |
| **인증 필요 여부** | ✅ Yes (Bearer Token) |

---

## 3. 요청 데이터 (Request)

### 3-1. Header

```http
Authorization: Bearer {access_token}
Content-Type: application/json
```

### 3-2. Path Variable

| **필드명** | **타입** | **필수 여부** | **설명** |
| --- | --- | --- | --- |
| `id` | UUID | 필수 | 캡슐(이스터에그) ID |

### 3-3. Body (POST - 발견 기록 시)

```json
{}
```
> Body 없이 빈 객체로 요청

---

## 4. 응답 데이터 (Response)

### 4-1. 성공 응답

#### POST /api/capsules/:id/viewers (발견 기록)

**201 Created - 첫 발견**
```json
{
  "success": true,
  "message": "이스터에그를 발견했습니다!",
  "is_first_view": true
}
```

**201 Created - 이미 발견한 경우**
```json
{
  "success": true,
  "message": "이미 발견한 이스터에그입니다.",
  "is_first_view": false
}
```

#### GET /api/capsules/:id/viewers (발견자 목록)

**200 OK**
```json
{
  "capsule_id": "550e8400-e29b-41d4-a716-446655440000",
  "total_viewers": 3,
  "view_limit": 10,
  "viewers": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "nickname": "김철수",
      "profile_img": "https://example.com/profile1.jpg",
      "viewed_at": "2025-01-02T10:30:00.000Z"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440002",
      "nickname": "이영희",
      "profile_img": "https://example.com/profile2.jpg",
      "viewed_at": "2025-01-02T11:15:00.000Z"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440003",
      "nickname": "박민수",
      "profile_img": null,
      "viewed_at": "2025-01-02T12:00:00.000Z"
    }
  ]
}
```

### 4-2. 에러 (Error Case)

| **상태 코드** | **에러 코드** | **사유** |
| --- | --- | --- |
| 400 | `BAD_REQUEST` | 잘못된 UUID 형식 |
| 401 | `UNAUTHORIZED` | 인증 토큰 만료 또는 누락 |
| 404 | `CAPSULE_NOT_FOUND` | 캡슐이 존재하지 않거나 삭제됨 |

**에러 응답 예시**
```json
{
  "statusCode": 404,
  "message": "CAPSULE_NOT_FOUND",
  "error": "Not Found"
}
```

---

## 5. 비즈니스 로직 및 제약 사항

- [x] **중복 조회 방지**: 동일 사용자가 동일 캡슐을 여러 번 조회해도 `view_count`는 1번만 증가
- [x] **조회 로그 저장**: `capsule_access_logs` 테이블에 기록 (Unique 제약: `capsuleId` + `viewerId`)
- [x] **조회자 목록 정렬**: 조회 시각(`viewed_at`) 오름차순으로 반환
- [x] **본인 캡슐도 조회 가능**: 작성자도 자신의 이스터에그를 발견 기록할 수 있음
- [x] **삭제된 캡슐 처리**: `deletedAt`이 null이 아닌 캡슐은 404 반환

---

## 6. 재사용된 기존 코드

### 6-1. 엔티티
- `CapsuleAccessLog` - 캡슐 조회 로그 테이블 (기존)
- `Capsule` - 캡슐 엔티티 (기존)
- `User` - 사용자 엔티티 (기존)

### 6-2. 메서드
- `logCapsuleAccess()` - 조회 로그 기록 메서드 (기존 private 메서드 재사용)
- `findOne()` 메서드의 viewers 조회 로직 참고

### 6-3. 새로 구현된 메서드
- `recordCapsuleViewer()` - 발견 기록 메서드 (새로 구현)
- `getCapsuleViewers()` - 발견자 목록 조회 메서드 (새로 구현)

---

## 7. 구현 상세

### 7-1. Service Layer

#### `recordCapsuleViewer()`
```typescript
async recordCapsuleViewer(
  user: User,
  capsuleId: string,
): Promise<{ success: boolean; message: string; is_first_view: boolean }>
```

**동작**:
1. 캡슐 존재 확인
2. 기존 조회 로그 확인 (중복 체크)
3. `logCapsuleAccess()` 호출하여 로그 저장
4. 첫 조회인 경우 `view_count` 증가
5. 결과 반환

#### `getCapsuleViewers()`
```typescript
async getCapsuleViewers(
  user: User,
  capsuleId: string,
): Promise<GetViewersResponseDto>
```

**동작**:
1. 캡슐 존재 확인
2. `capsule_access_logs` 조회 (viewer 관계 포함)
3. 조회 시각 오름차순 정렬
4. DTO 형태로 반환

### 7-2. Controller Layer

```typescript
@Post(':id/viewers')
@UseGuards(JwtAuthGuard)
async recordViewer(
  @CurrentUser() user: User,
  @Param('id', ParseUUIDPipe) capsuleId: string,
)

@Get(':id/viewers')
@UseGuards(JwtAuthGuard)
async getViewers(
  @CurrentUser() user: User,
  @Param('id', ParseUUIDPipe) capsuleId: string,
): Promise<GetViewersResponseDto>
```

---

## 8. 테스트 시나리오

### 8-1. POST /api/capsules/:id/viewers

**시나리오 1: 첫 발견**
- **Given**: 사용자가 이스터에그를 처음 발견
- **When**: POST /api/capsules/:id/viewers 요청
- **Then**: 
  - `is_first_view: true` 반환
  - `view_count` 1 증가
  - `capsule_access_logs`에 새 레코드 추가

**시나리오 2: 중복 발견**
- **Given**: 사용자가 이미 발견한 이스터에그
- **When**: POST /api/capsules/:id/viewers 재요청
- **Then**: 
  - `is_first_view: false` 반환
  - `view_count` 증가 없음
  - `capsule_access_logs`에 중복 저장 안 됨 (Unique 제약)

**시나리오 3: 존재하지 않는 캡슐**
- **Given**: 삭제되었거나 존재하지 않는 캡슐 ID
- **When**: POST /api/capsules/:id/viewers 요청
- **Then**: 404 CAPSULE_NOT_FOUND 반환

### 8-2. GET /api/capsules/:id/viewers

**시나리오 1: 발견자 목록 조회**
- **Given**: 3명의 사용자가 이스터에그를 발견
- **When**: GET /api/capsules/:id/viewers 요청
- **Then**: 
  - `total_viewers: 3` 반환
  - 조회 시각 오름차순 정렬
  - 각 발견자의 닉네임, 프로필 이미지 포함

**시나리오 2: 발견자가 없는 경우**
- **Given**: 아무도 발견하지 않은 이스터에그
- **When**: GET /api/capsules/:id/viewers 요청
- **Then**: 
  - `total_viewers: 0` 반환
  - `viewers: []` 빈 배열 반환

---

## 9. 데이터베이스 스키마 (기존)

### capsule_access_logs

| 컬럼명 | 타입 | 제약 | 설명 |
| --- | --- | --- | --- |
| id | UUID | PK | 로그 ID |
| capsule_id | UUID | FK, Not Null | 캡슐 ID |
| viewer_id | UUID | FK, Not Null | 조회자 ID |
| viewed_at | TIMESTAMP | Not Null | 조회 시각 |
| **UNIQUE** | - | **(capsule_id, viewer_id)** | 중복 조회 방지 |

---

## 10. API 호출 예시

### cURL

**발견 기록**
```bash
curl -X POST https://api.banny-banny.com/api/capsules/550e8400-e29b-41d4-a716-446655440000/viewers \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json"
```

**발견자 목록 조회**
```bash
curl -X GET https://api.banny-banny.com/api/capsules/550e8400-e29b-41d4-a716-446655440000/viewers \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

## 11. 참고사항

- Swagger 문서: http://localhost:3000/api/docs
- 기존 캡슐 조회 API (`GET /api/capsules/:id`)에도 `viewers` 필드가 포함되어 있으므로, 별도 API 없이도 조회자 목록을 확인할 수 있습니다. 
- 이번 구현은 **독립적인 엔드포인트**를 제공하여 발견 기록과 조회를 명확히 분리했습니다.

