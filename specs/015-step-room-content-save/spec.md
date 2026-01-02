# 015 - 스텝룸 내 콘텐츠 저장 API

## 개요

스텝룸에 참여한 사용자가 자신의 콘텐츠(텍스트, 이미지, 음성, 동영상)를 업로드하고 저장할 수 있는 API를 구현합니다.

## 배경

- 스텝룸 생성 후, 참여자들이 각자 콘텐츠를 작성해야 캡슐이 완성됩니다
- 각 사용자는 캡슐 설정에 따라 제한된 형식의 콘텐츠만 업로드할 수 있습니다
- 콘텐츠는 한번에 저장되며, 저장 후 수정(재저장)이 가능합니다

## 목표

1. 스텝룸에 참여한 사용자가 자신의 콘텐츠를 저장할 수 있는 API 제공
2. 캡슐 설정값에 따른 업로드 제한 검증
3. 권한 및 인원 제한 검증
4. 콘텐츠 저장 후 자동으로 사용자 상태를 `COMPLETED`로 변경

## 기능 요구사항

### 1. API Endpoint

```
POST /api/step-rooms/{roomId}/my-content
```

### 2. Request

**Content-Type**: `multipart/form-data`

**Parameters**:
- `roomId` (path parameter): 스텝룸(캡슐) ID (UUID)

**Body**:
- `text_message`: string (필수, 무료 제공) - 텍스트 메시지
- `images`: File[] (선택) - 이미지 파일 배열 (0~5개, 설정값에 따라 제한)
- `music`: File (선택) - 음성 파일 (1개, has_music=true일 때만 허용)
- `video`: File (선택) - 동영상 파일 (1개, has_video=true일 때만 허용)

### 3. Response

#### 성공 (200 OK)

```json
{
  "success": true,
  "data": {
    "user_id": "uuid",
    "nickname": "초롱",
    "status": "COMPLETED",
    "saved_at": "2025-12-30T13:00:00Z",
    "uploaded_images": 3,
    "uploaded_music": true,
    "uploaded_video": false
  }
}
```

#### 실패 사례

**1) 음성 업로드 불가 (400 Bad Request)**
```json
{
  "success": false,
  "error": "MUSIC_NOT_ALLOWED",
  "message": "이 캡슐은 음성 추가를 허용하지 않습니다"
}
```

**2) 사진 개수 초과 (400 Bad Request)**
```json
{
  "success": false,
  "error": "IMAGE_LIMIT_EXCEEDED",
  "message": "사진은 최대 3장까지 업로드할 수 있습니다",
  "data": {
    "max_images": 3,
    "uploaded_images": 5
  }
}
```

**3) 동영상 업로드 불가 (400 Bad Request)**
```json
{
  "success": false,
  "error": "VIDEO_NOT_ALLOWED",
  "message": "이 캡슐은 동영상 추가를 허용하지 않습니다"
}
```

**4) 결제되지 않은 캡슐 (403 Forbidden)**
```json
{
  "success": false,
  "error": "PAYMENT_REQUIRED",
  "message": "결제가 완료된 캡슐만 콘텐츠를 작성할 수 있습니다"
}
```

**5) 인원 초과 (403 Forbidden)**
```json
{
  "success": false,
  "error": "PARTICIPANT_LIMIT_EXCEEDED",
  "message": "캡슐 참여 인원이 초과되었습니다",
  "data": {
    "max_participants": 5,
    "current_participants": 5
  }
}
```

**6) 권한 없음 (403 Forbidden)**
```json
{
  "success": false,
  "error": "UNAUTHORIZED_ACCESS",
  "message": "이 캡슐에 접근할 권한이 없습니다"
}
```

**7) 캡슐을 찾을 수 없음 (404 Not Found)**
```json
{
  "success": false,
  "error": "CAPSULE_NOT_FOUND",
  "message": "캡슐을 찾을 수 없습니다"
}
```

## 검증 로직

### 1. 기본 검증
- ✅ 캡슐이 존재하는지 확인
- ✅ 요청한 사용자가 인증된 사용자인지 확인

### 2. 결제 상태 검증
- ✅ 캡슐과 연결된 주문(order)의 상태가 `PAID`인지 확인
- ❌ `PAID`가 아니면 → `PAYMENT_REQUIRED` 에러

### 3. 권한 검증
- ✅ 다음 중 하나를 만족해야 함:
  - 캡슐 소유자(creator)인 경우
  - 초대코드를 가지고 있는 경우 (초대코드 검증은 별도 로직 필요)
  - 이미 참여 슬롯이 있는 경우
- ❌ 권한이 없으면 → `UNAUTHORIZED_ACCESS` 에러

### 4. 인원 제한 검증
- ✅ 현재 참여자 수가 `max_participants` 미만인지 확인
- ✅ 이미 슬롯이 있는 사용자는 인원 제한에서 제외 (재저장 케이스)
- ❌ 인원 초과 시 → `PARTICIPANT_LIMIT_EXCEEDED` 에러

### 5. 미디어 설정 검증
- ✅ `has_music=false`인데 음성 파일이 있으면 → `MUSIC_NOT_ALLOWED` 에러
- ✅ `has_video=false`인데 동영상 파일이 있으면 → `VIDEO_NOT_ALLOWED` 에러
- ✅ 이미지 개수가 `max_images_per_person` 초과 시 → `IMAGE_LIMIT_EXCEEDED` 에러

### 6. 저장 처리
- ✅ 기존 슬롯이 있으면 업데이트 (재저장)
- ✅ 기존 슬롯이 없으면 새로 생성
- ✅ 미디어 파일 업로드 처리 (Media 엔티티 생성)
- ✅ 슬롯 상태를 `COMPLETED`로 변경
- ✅ 저장 시간 기록

## 데이터 모델

### CapsuleParticipantSlot 엔티티 활용

```typescript
{
  id: UUID,
  capsule_id: UUID,
  user_id: UUID,
  nickname: string,
  text_message: string,
  images: Media[],
  music: Media,
  video: Media,
  status: 'PENDING' | 'COMPLETED',
  created_at: timestamp,
  updated_at: timestamp
}
```

### Media 엔티티 활용

```typescript
{
  id: UUID,
  media_type: 'IMAGE' | 'MUSIC' | 'VIDEO',
  original_url: string,
  compressed_url: string,
  file_size: number,
  created_at: timestamp
}
```

## 비즈니스 룰

1. **텍스트 메시지는 필수**
   - 모든 참여자는 반드시 텍스트를 작성해야 함

2. **재저장(수정) 가능**
   - 한번 저장한 사용자도 다시 저장할 수 있음
   - 기존 미디어는 덮어씌워짐

3. **인원 제한**
   - `max_participants`를 초과할 수 없음
   - 이미 슬롯이 있는 사용자는 제한에서 제외

4. **미디어 제한**
   - 캡슐 설정에 따라 업로드 가능한 미디어 타입이 결정됨
   - 설정과 다른 미디어를 업로드하면 에러 발생

5. **권한 관리**
   - 캡슐 소유자는 항상 접근 가능
   - 초대코드를 가진 사용자는 접근 가능
   - 이미 참여 중인 사용자는 재저장 가능

## 기술 스택

- **Framework**: NestJS
- **File Upload**: `@nestjs/platform-express` with `multer`
- **ORM**: TypeORM
- **Database**: PostgreSQL
- **File Storage**: (기존 Media 서비스 활용)

## 보안 고려사항

1. **인증**: JWT 토큰으로 사용자 인증
2. **파일 크기 제한**: 각 파일 타입별 최대 크기 설정
3. **파일 타입 검증**: 허용된 MIME 타입만 업로드 가능
4. **권한 검증**: 캡슐 접근 권한 확인

## 성능 고려사항

1. **트랜잭션 처리**: 콘텐츠 저장과 상태 변경을 트랜잭션으로 묶음
2. **파일 업로드 최적화**: 비동기 업로드 처리
3. **데이터베이스 쿼리 최적화**: JOIN을 최소화하고 필요한 데이터만 조회

## 향후 확장 가능성

1. **임시 저장 기능**: 작성 중인 콘텐츠를 임시 저장
2. **미리보기 기능**: 저장 전 미리보기 제공
3. **알림 기능**: 모든 참여자가 작성 완료하면 알림 발송
4. **실시간 진행률**: 참여자별 작성 완료 상태 표시

## 성공 기준

- ✅ 사용자가 콘텐츠를 성공적으로 저장할 수 있음
- ✅ 모든 검증 로직이 정상적으로 작동함
- ✅ 재저장(수정) 기능이 정상적으로 작동함
- ✅ 에러 케이스가 명확하게 처리됨
- ✅ API 문서(Swagger)가 제공됨

## 참고

- 기존 CapsuleParticipantSlot 엔티티 활용
- 기존 Media 서비스 활용
- 기존 인증 시스템 활용

