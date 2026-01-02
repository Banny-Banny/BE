# 015 - 스텝룸 내 콘텐츠 저장 API 구현 태스크

## 진행 상태

- 총 태스크: 10개
- 완료: 0개
- 진행 중: 0개
- 대기 중: 10개

## 태스크 목록

### Task 1: DTO 생성 ⏳
**상태**: 대기 중
**예상 시간**: 30분
**의존성**: 없음

#### 세부 작업
1. `src/capsules/dto/save-content.dto.ts` 생성
   - `SaveContentDto` 클래스 정의
   - 필드: `text_message`, `invite_code` (선택)
   - Validation 데코레이터 추가
   - Swagger 데코레이터 추가

2. `src/capsules/dto/content-response.dto.ts` 생성
   - `ContentResponseDto` 클래스 정의
   - `ContentDataDto` 중첩 클래스 정의
   - Swagger 데코레이터 추가

#### 완료 기준
- [ ] DTO 파일 생성 완료
- [ ] 모든 필드에 validation 데코레이터 적용
- [ ] Swagger 문서화 완료
- [ ] 타입스크립트 컴파일 에러 없음

#### 예상 코드 변경
```typescript
// src/capsules/dto/save-content.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class SaveContentDto {
  @ApiProperty({ 
    description: '텍스트 메시지', 
    example: '안녕하세요! 오늘 정말 행복한 하루였어요.' 
  })
  @IsString()
  @IsNotEmpty({ message: '텍스트 메시지는 필수입니다' })
  text_message: string;

  @ApiPropertyOptional({ 
    description: '초대 코드 (선택)', 
    example: 'ABC123' 
  })
  @IsString()
  @IsOptional()
  invite_code?: string;

  @ApiPropertyOptional({
    type: 'array',
    items: { type: 'string', format: 'binary' },
    description: '이미지 파일 (최대 5개)',
  })
  images?: any;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: '음성 파일',
  })
  music?: any;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: '동영상 파일',
  })
  video?: any;
}

// src/capsules/dto/content-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class ContentDataDto {
  @ApiProperty({ description: '사용자 ID' })
  user_id: string;

  @ApiProperty({ description: '닉네임' })
  nickname: string;

  @ApiProperty({ description: '상태', example: 'COMPLETED' })
  status: string;

  @ApiProperty({ description: '저장 시간' })
  saved_at: Date;

  @ApiProperty({ description: '업로드된 이미지 개수' })
  uploaded_images: number;

  @ApiProperty({ description: '음성 업로드 여부' })
  uploaded_music: boolean;

  @ApiProperty({ description: '동영상 업로드 여부' })
  uploaded_video: boolean;
}

export class ContentResponseDto {
  @ApiProperty({ description: '성공 여부' })
  success: boolean;

  @ApiProperty({ description: '응답 데이터', type: ContentDataDto })
  data: ContentDataDto;
}
```

---

### Task 2: 검증 메서드 구현 - 캡슐 조회 ⏳
**상태**: 대기 중
**예상 시간**: 20분
**의존성**: Task 1

#### 세부 작업
1. `capsules.service.ts`에 `findCapsuleWithRelations()` 메서드 추가
   - 캡슐 ID로 조회
   - relations: order, order.payment, participantSlots, participantSlots.user
   - 캡슐이 없으면 NotFoundException 던지기

#### 완료 기준
- [ ] `findCapsuleWithRelations()` 메서드 구현
- [ ] 필요한 relations 모두 로드
- [ ] 에러 응답 형식 일치

#### 예상 코드
```typescript
private async findCapsuleWithRelations(roomId: string): Promise<Capsule> {
  const capsule = await this.capsuleRepository.findOne({
    where: { id: roomId },
    relations: [
      'order',
      'order.payment',
      'participantSlots',
      'participantSlots.user',
    ],
  });

  if (!capsule) {
    throw new NotFoundException({
      success: false,
      error: 'CAPSULE_NOT_FOUND',
      message: '캡슐을 찾을 수 없습니다',
    });
  }

  return capsule;
}
```

---

### Task 3: 검증 메서드 구현 - 결제 상태 검증 ⏳
**상태**: 대기 중
**예상 시간**: 15분
**의존성**: Task 2

#### 세부 작업
1. `capsules.service.ts`에 `validatePaymentStatus()` 메서드 추가
   - order가 있는지 확인
   - order.status가 'PAID'인지 확인
   - 아니면 ForbiddenException 던지기

#### 완료 기준
- [ ] `validatePaymentStatus()` 메서드 구현
- [ ] 에러 응답 형식 일치
- [ ] 에러 코드: `PAYMENT_REQUIRED`

#### 예상 코드
```typescript
private validatePaymentStatus(capsule: Capsule): void {
  if (!capsule.order || capsule.order.status !== 'PAID') {
    throw new ForbiddenException({
      success: false,
      error: 'PAYMENT_REQUIRED',
      message: '결제가 완료된 캡슐만 콘텐츠를 작성할 수 있습니다',
    });
  }
}
```

---

### Task 4: 검증 메서드 구현 - 권한 검증 ⏳
**상태**: 대기 중
**예상 시간**: 30분
**의존성**: Task 3

#### 세부 작업
1. `capsules.service.ts`에 `validateAccessPermission()` 메서드 추가
   - 캡슐 소유자인지 확인
   - 이미 참여 슬롯이 있는지 확인
   - 초대코드가 일치하는지 확인
   - 모두 아니면 ForbiddenException 던지기

#### 완료 기준
- [ ] `validateAccessPermission()` 메서드 구현
- [ ] 세 가지 권한 조건 모두 확인
- [ ] 에러 응답 형식 일치
- [ ] 에러 코드: `UNAUTHORIZED_ACCESS`

#### 예상 코드
```typescript
private validateAccessPermission(
  capsule: Capsule,
  userId: string,
  inviteCode?: string,
): void {
  // 1. 캡슐 소유자인지 확인
  if (capsule.user_id === userId) {
    return;
  }

  // 2. 이미 참여 슬롯이 있는지 확인
  const existingSlot = capsule.participantSlots?.find(
    slot => slot.user_id === userId,
  );
  if (existingSlot) {
    return;
  }

  // 3. 초대코드 검증
  if (capsule.invite_code && inviteCode === capsule.invite_code) {
    return;
  }

  // 권한 없음
  throw new ForbiddenException({
    success: false,
    error: 'UNAUTHORIZED_ACCESS',
    message: '이 캡슐에 접근할 권한이 없습니다',
  });
}
```

---

### Task 5: 검증 메서드 구현 - 인원 제한 검증 ⏳
**상태**: 대기 중
**예상 시간**: 20분
**의존성**: Task 4

#### 세부 작업
1. `capsules.service.ts`에 `validateParticipantLimit()` 메서드 추가
   - 기존 슬롯이 있으면 통과 (재저장 케이스)
   - 현재 참여자 수 확인
   - max_participants 초과하면 ForbiddenException 던지기

#### 완료 기준
- [ ] `validateParticipantLimit()` 메서드 구현
- [ ] 재저장 케이스 처리
- [ ] 에러 응답 형식 일치
- [ ] 에러 코드: `PARTICIPANT_LIMIT_EXCEEDED`

#### 예상 코드
```typescript
private validateParticipantLimit(
  capsule: Capsule,
  userId: string,
): void {
  // 기존 슬롯이 있으면 인원 제한에서 제외 (재저장 케이스)
  const existingSlot = capsule.participantSlots?.find(
    slot => slot.user_id === userId,
  );
  if (existingSlot) {
    return;
  }

  const currentParticipants = capsule.participantSlots?.length || 0;
  const maxParticipants = capsule.max_participants || 1;

  if (currentParticipants >= maxParticipants) {
    throw new ForbiddenException({
      success: false,
      error: 'PARTICIPANT_LIMIT_EXCEEDED',
      message: '캡슐 참여 인원이 초과되었습니다',
      data: {
        max_participants: maxParticipants,
        current_participants: currentParticipants,
      },
    });
  }
}
```

---

### Task 6: 검증 메서드 구현 - 미디어 설정 검증 ⏳
**상태**: 대기 중
**예상 시간**: 25분
**의존성**: Task 5

#### 세부 작업
1. `capsules.service.ts`에 `validateMediaSettings()` 메서드 추가
   - has_music 설정 확인
   - has_video 설정 확인
   - max_images_per_person 설정 확인
   - 위반 시 BadRequestException 던지기

#### 완료 기준
- [ ] `validateMediaSettings()` 메서드 구현
- [ ] 세 가지 미디어 타입 검증
- [ ] 에러 응답 형식 일치
- [ ] 에러 코드: `MUSIC_NOT_ALLOWED`, `VIDEO_NOT_ALLOWED`, `IMAGE_LIMIT_EXCEEDED`

#### 예상 코드
```typescript
private validateMediaSettings(
  capsule: Capsule,
  files: {
    images?: Express.Multer.File[];
    music?: Express.Multer.File[];
    video?: Express.Multer.File[];
  },
): void {
  // 음성 파일 검증
  if (files.music && files.music.length > 0 && !capsule.has_music) {
    throw new BadRequestException({
      success: false,
      error: 'MUSIC_NOT_ALLOWED',
      message: '이 캡슐은 음성 추가를 허용하지 않습니다',
    });
  }

  // 동영상 파일 검증
  if (files.video && files.video.length > 0 && !capsule.has_video) {
    throw new BadRequestException({
      success: false,
      error: 'VIDEO_NOT_ALLOWED',
      message: '이 캡슐은 동영상 추가를 허용하지 않습니다',
    });
  }

  // 이미지 개수 검증
  if (files.images && files.images.length > 0) {
    const uploadedCount = files.images.length;
    const maxImages = capsule.max_images_per_person || 0;

    if (uploadedCount > maxImages) {
      throw new BadRequestException({
        success: false,
        error: 'IMAGE_LIMIT_EXCEEDED',
        message: `사진은 최대 ${maxImages}장까지 업로드할 수 있습니다`,
        data: {
          max_images: maxImages,
          uploaded_images: uploadedCount,
        },
      });
    }
  }
}
```

---

### Task 7: 콘텐츠 저장 로직 구현 (트랜잭션) ⏳
**상태**: 대기 중
**예상 시간**: 60분
**의존성**: Task 6

#### 세부 작업
1. `capsules.service.ts`에 `saveContentTransaction()` 메서드 추가
   - 트랜잭션 시작
   - 사용자 조회
   - 기존 슬롯 확인
   - 기존 미디어 삭제 (재저장 케이스)
   - 텍스트 메시지 저장
   - 미디어 파일 업로드 및 저장
   - 상태를 COMPLETED로 변경
   - 슬롯 저장
   - 응답 생성

#### 완료 기준
- [ ] `saveContentTransaction()` 메서드 구현
- [ ] 트랜잭션으로 묶음
- [ ] 재저장 케이스 처리
- [ ] 미디어 업로드 및 저장
- [ ] 응답 형식 일치

#### 예상 코드
```typescript
private async saveContentTransaction(
  capsule: Capsule,
  userId: string,
  user: User,
  saveContentDto: SaveContentDto,
  files: {
    images?: Express.Multer.File[];
    music?: Express.Multer.File[];
    video?: Express.Multer.File[];
  },
): Promise<ContentResponseDto> {
  return await this.dataSource.transaction(async (manager) => {
    const slotRepo = manager.getRepository(CapsuleParticipantSlot);
    const mediaRepo = manager.getRepository(Media);

    // 1. 기존 슬롯 확인
    let slot = await slotRepo.findOne({
      where: { capsule_id: capsule.id, user_id: userId },
      relations: ['images', 'music', 'video'],
    });

    // 2. 기존 미디어 삭제 (재저장 케이스)
    if (slot) {
      if (slot.images?.length > 0) {
        await mediaRepo.remove(slot.images);
      }
      if (slot.music) {
        await mediaRepo.remove(slot.music);
      }
      if (slot.video) {
        await mediaRepo.remove(slot.video);
      }
    } else {
      // 3. 새 슬롯 생성
      slot = slotRepo.create({
        capsule_id: capsule.id,
        user_id: userId,
        nickname: user.nickname || '익명',
        status: 'PENDING',
      });
    }

    // 4. 텍스트 메시지 저장
    slot.text_message = saveContentDto.text_message;

    // 5. 이미지 업로드 및 저장
    const uploadedImages = [];
    if (files.images && files.images.length > 0) {
      for (const imageFile of files.images) {
        const media = await this.mediaService.uploadFile(imageFile, 'IMAGE');
        const savedMedia = await mediaRepo.save(media);
        uploadedImages.push(savedMedia);
      }
      slot.images = uploadedImages;
    } else {
      slot.images = [];
    }

    // 6. 음성 업로드 및 저장
    if (files.music && files.music.length > 0) {
      const media = await this.mediaService.uploadFile(files.music[0], 'MUSIC');
      slot.music = await mediaRepo.save(media);
    } else {
      slot.music = null;
    }

    // 7. 동영상 업로드 및 저장
    if (files.video && files.video.length > 0) {
      const media = await this.mediaService.uploadFile(files.video[0], 'VIDEO');
      slot.video = await mediaRepo.save(media);
    } else {
      slot.video = null;
    }

    // 8. 상태를 COMPLETED로 변경
    slot.status = 'COMPLETED';
    slot.updated_at = new Date();

    // 9. 슬롯 저장
    await slotRepo.save(slot);

    // 10. 응답 생성
    return {
      success: true,
      data: {
        user_id: userId,
        nickname: slot.nickname,
        status: slot.status,
        saved_at: slot.updated_at,
        uploaded_images: uploadedImages.length,
        uploaded_music: !!slot.music,
        uploaded_video: !!slot.video,
      },
    };
  });
}
```

---

### Task 8: 메인 Service 메서드 구현 ⏳
**상태**: 대기 중
**예상 시간**: 30분
**의존성**: Task 7

#### 세부 작업
1. `capsules.service.ts`에 `saveMyContent()` 메서드 추가
   - 모든 검증 메서드 호출
   - 저장 트랜잭션 호출
   - 에러 처리

2. User 조회 로직 추가

#### 완료 기준
- [ ] `saveMyContent()` 메서드 구현
- [ ] 모든 검증 단계 포함
- [ ] 에러 처리 완료

#### 예상 코드
```typescript
async saveMyContent(
  roomId: string,
  userId: string,
  saveContentDto: SaveContentDto,
  files: {
    images?: Express.Multer.File[];
    music?: Express.Multer.File[];
    video?: Express.Multer.File[];
  },
): Promise<ContentResponseDto> {
  // 1. 캡슐 조회 (with relations)
  const capsule = await this.findCapsuleWithRelations(roomId);
  
  // 2. 결제 상태 검증
  this.validatePaymentStatus(capsule);
  
  // 3. 권한 검증
  this.validateAccessPermission(capsule, userId, saveContentDto.invite_code);
  
  // 4. 인원 제한 검증
  this.validateParticipantLimit(capsule, userId);
  
  // 5. 미디어 설정 검증
  this.validateMediaSettings(capsule, files);

  // 6. 사용자 조회
  const user = await this.userRepository.findOne({ where: { id: userId } });
  if (!user) {
    throw new NotFoundException({
      success: false,
      error: 'USER_NOT_FOUND',
      message: '사용자를 찾을 수 없습니다',
    });
  }
  
  // 7. 콘텐츠 저장 (트랜잭션)
  return await this.saveContentTransaction(capsule, userId, user, saveContentDto, files);
}
```

---

### Task 9: Controller 메서드 구현 ⏳
**상태**: 대기 중
**예상 시간**: 40분
**의존성**: Task 8

#### 세부 작업
1. `capsules.controller.ts`에 `saveMyContent()` 엔드포인트 추가
   - POST /api/step-rooms/:roomId/my-content
   - FileFieldsInterceptor 적용
   - JwtAuthGuard 적용
   - Swagger 데코레이터 추가

2. Multer 파일 타입 정의

#### 완료 기준
- [ ] Controller 메서드 구현
- [ ] 파일 업로드 설정 완료
- [ ] Swagger 문서화 완료
- [ ] 에러 응답 문서화 완료

#### 예상 코드
```typescript
@Post(':roomId/my-content')
@UseGuards(JwtAuthGuard)
@UseInterceptors(
  FileFieldsInterceptor([
    { name: 'images', maxCount: 5 },
    { name: 'music', maxCount: 1 },
    { name: 'video', maxCount: 1 },
  ]),
)
@ApiTags('Step Rooms')
@ApiBearerAuth()
@ApiOperation({ 
  summary: '스텝룸 콘텐츠 저장',
  description: '스텝룸에 참여한 사용자가 자신의 콘텐츠를 저장합니다.'
})
@ApiConsumes('multipart/form-data')
@ApiResponse({ 
  status: 200, 
  description: '콘텐츠 저장 성공',
  type: ContentResponseDto,
})
@ApiResponse({ 
  status: 400, 
  description: '잘못된 요청 (미디어 설정 위반 등)',
  schema: {
    example: {
      success: false,
      error: 'IMAGE_LIMIT_EXCEEDED',
      message: '사진은 최대 3장까지 업로드할 수 있습니다',
      data: {
        max_images: 3,
        uploaded_images: 5,
      },
    },
  },
})
@ApiResponse({ 
  status: 403, 
  description: '권한 없음 또는 인원 초과',
  schema: {
    example: {
      success: false,
      error: 'UNAUTHORIZED_ACCESS',
      message: '이 캡슐에 접근할 권한이 없습니다',
    },
  },
})
@ApiResponse({ 
  status: 404, 
  description: '캡슐을 찾을 수 없음',
  schema: {
    example: {
      success: false,
      error: 'CAPSULE_NOT_FOUND',
      message: '캡슐을 찾을 수 없습니다',
    },
  },
})
async saveMyContent(
  @Param('roomId', ParseUUIDPipe) roomId: string,
  @CurrentUser() user: User,
  @Body() saveContentDto: SaveContentDto,
  @UploadedFiles()
  files: {
    images?: Express.Multer.File[];
    music?: Express.Multer.File[];
    video?: Express.Multer.File[];
  },
): Promise<ContentResponseDto> {
  return this.capsulesService.saveMyContent(
    roomId,
    user.id,
    saveContentDto,
    files,
  );
}
```

---

### Task 10: E2E 테스트 작성 ⏳
**상태**: 대기 중
**예상 시간**: 60분
**의존성**: Task 9

#### 세부 작업
1. `tests/playwright/step-room-content.spec.ts` 생성
2. 테스트 케이스 작성:
   - 새로운 콘텐츠 저장 성공
   - 기존 콘텐츠 재저장 성공
   - 결제 안된 캡슐에 저장 실패
   - 권한 없는 사용자 저장 실패
   - 인원 초과 시 저장 실패
   - 음성 업로드 불가 설정에서 음성 업로드 실패
   - 동영상 업로드 불가 설정에서 동영상 업로드 실패
   - 이미지 개수 초과 시 저장 실패

#### 완료 기준
- [ ] E2E 테스트 파일 생성
- [ ] 모든 성공 케이스 테스트
- [ ] 모든 실패 케이스 테스트
- [ ] 모든 테스트 통과

#### 예상 코드
```typescript
import { test, expect } from '@playwright/test';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

const API_URL = 'http://localhost:3000/api';

test.describe('Step Room Content Save API', () => {
  let authToken: string;
  let userId: string;
  let capsuleId: string;

  test.beforeAll(async ({ request }) => {
    // 사용자 생성 및 로그인
    // ...
  });

  test('should save content successfully', async ({ request }) => {
    // 1. 캡슐 생성 및 결제
    const createResponse = await request.post(`${API_URL}/capsules`, {
      headers: { Authorization: `Bearer ${authToken}` },
      data: {
        title: 'Test Capsule',
        max_participants: 3,
        has_music: true,
        has_video: true,
        max_images_per_person: 3,
      },
    });
    const { id } = await createResponse.json();
    capsuleId = id;

    // 결제 처리
    // ...

    // 2. 콘텐츠 저장
    const formData = new FormData();
    formData.append('text_message', '안녕하세요!');
    formData.append('images', fs.createReadStream(path.join(__dirname, 'fixtures/test-image.jpg')));

    const saveResponse = await request.post(`${API_URL}/step-rooms/${capsuleId}/my-content`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
        ...formData.getHeaders(),
      },
      data: formData,
    });

    expect(saveResponse.status()).toBe(200);
    const result = await saveResponse.json();
    expect(result.success).toBe(true);
    expect(result.data.status).toBe('COMPLETED');
    expect(result.data.uploaded_images).toBe(1);
  });

  test('should reject when payment is not completed', async ({ request }) => {
    // 1. 캡슐 생성 (결제 안함)
    const createResponse = await request.post(`${API_URL}/capsules`, {
      headers: { Authorization: `Bearer ${authToken}` },
      data: {
        title: 'Test Capsule',
      },
    });
    const { id } = await createResponse.json();

    // 2. 콘텐츠 저장 시도
    const formData = new FormData();
    formData.append('text_message', '안녕하세요!');

    const saveResponse = await request.post(`${API_URL}/step-rooms/${id}/my-content`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
        ...formData.getHeaders(),
      },
      data: formData,
    });

    expect(saveResponse.status()).toBe(403);
    const result = await saveResponse.json();
    expect(result.success).toBe(false);
    expect(result.error).toBe('PAYMENT_REQUIRED');
  });

  test('should reject when participant limit exceeded', async ({ request }) => {
    // 구현...
  });

  test('should reject music upload when not allowed', async ({ request }) => {
    // 구현...
  });

  test('should reject video upload when not allowed', async ({ request }) => {
    // 구현...
  });

  test('should reject when image limit exceeded', async ({ request }) => {
    // 구현...
  });

  test('should update content successfully (re-save)', async ({ request }) => {
    // 구현...
  });
});
```

---

## 구현 순서

1. ✅ Task 1: DTO 생성
2. ✅ Task 2: 검증 메서드 - 캡슐 조회
3. ✅ Task 3: 검증 메서드 - 결제 상태 검증
4. ✅ Task 4: 검증 메서드 - 권한 검증
5. ✅ Task 5: 검증 메서드 - 인원 제한 검증
6. ✅ Task 6: 검증 메서드 - 미디어 설정 검증
7. ✅ Task 7: 콘텐츠 저장 로직 (트랜잭션)
8. ✅ Task 8: 메인 Service 메서드
9. ✅ Task 9: Controller 메서드
10. ✅ Task 10: E2E 테스트

## 의존성 그래프

```
Task 1 (DTO)
  ↓
Task 2 (캡슐 조회)
  ↓
Task 3 (결제 검증)
  ↓
Task 4 (권한 검증)
  ↓
Task 5 (인원 검증)
  ↓
Task 6 (미디어 검증)
  ↓
Task 7 (저장 트랜잭션)
  ↓
Task 8 (메인 Service)
  ↓
Task 9 (Controller)
  ↓
Task 10 (E2E 테스트)
```

## 예상 소요 시간

- 총 예상 시간: **5시간 30분**
- Task 1-6 (검증 로직): 2시간 20분
- Task 7-8 (저장 로직): 1시간 30분
- Task 9 (Controller): 40분
- Task 10 (테스트): 1시간

## 주의사항

1. **트랜잭션 처리**: 콘텐츠 저장과 미디어 업로드는 트랜잭션으로 묶어야 함
2. **재저장 케이스**: 기존 미디어 삭제 후 새로운 미디어로 교체
3. **파일 업로드**: MediaService의 uploadFile 메서드 활용
4. **에러 응답 형식**: 모든 에러는 `{ success: false, error: string, message: string }` 형식
5. **인원 제한**: 재저장 케이스에서는 인원 제한에서 제외
6. **권한 검증**: 소유자, 기존 참여자, 초대코드 소지자만 접근 가능

## 테스트 체크리스트

- [ ] 새로운 콘텐츠 저장 성공
- [ ] 기존 콘텐츠 재저장 성공
- [ ] 결제 안된 캡슐에 저장 실패
- [ ] 권한 없는 사용자 저장 실패
- [ ] 인원 초과 시 저장 실패
- [ ] 음성 업로드 불가 설정 검증
- [ ] 동영상 업로드 불가 설정 검증
- [ ] 이미지 개수 초과 검증
- [ ] Swagger 문서 확인
- [ ] 에러 메시지 확인

