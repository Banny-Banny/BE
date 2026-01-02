# 015 - 스텝룸 내 콘텐츠 저장 API 구현 계획

## 0. 코드 재사용 분석

### 0.1 재사용 가능한 기존 메서드

#### ✅ CapsuleService (capsules.service.ts)

1. **`ensurePaidCapsuleContext(capsuleId)`** (800-824줄)
   - 캡슐 조회 + 결제 상태 검증
   - order, product, headcount 정보 반환
   - ✅ **재사용**: 결제 상태 검증에 활용

2. **`logCapsuleAccess(capsuleId, viewerId)`** (866-872줄)
   - 조회 로그 기록
   - ✅ **재사용 검토**: 필요시 활용

3. **`buildMediaItems(capsule, mediaEntities)`** (226-269줄)
   - 미디어 응답 빌드
   - ✅ **참고**: 응답 형식 참고용

#### ✅ MediaService (media.service.ts)

- **Presigned URL 방식**: 현재 MediaService는 S3 presigned URL 방식 사용
- **업로드 흐름**:
  1. `presign()`: 업로드 URL 발급
  2. 클라이언트가 S3에 직접 업로드
  3. `complete()`: 업로드 완료 후 Media 엔티티 생성
- ❌ **multipart/form-data 직접 업로드 지원 안함**
- ⚠️ **새로운 메서드 필요**: multer로 받은 파일을 S3에 업로드하는 메서드

### 0.2 기존 엔티티 활용

#### CapsuleParticipantSlot
- 현재 필드: `id`, `capsuleId`, `slotIndex`, `userId`, `assignedAt`
- ⚠️ **추가 필드 필요**:
  - `textMessage`: TEXT (필수)
  - `nickname`: VARCHAR(50)
  - `status`: ENUM('PENDING', 'COMPLETED')
- 💡 **마이그레이션 필요**: 새로운 컬럼 추가

#### Media
- 기존 엔티티 활용
- images, music, video를 별도 Media로 저장
- ManyToMany 또는 JSON 배열로 참조

### 0.3 라우터명 통일

기존 step-room 엔드포인트:
- `GET /api/capsules/step-rooms` (초대 코드로 조회)
- `GET /api/capsules/step-rooms/:capsuleId/settings`
- `GET /api/capsules/step-rooms/:capsuleId` (상세 조회)

✅ **새로운 엔드포인트**:
- `POST /api/capsules/step-rooms/:capsuleId/my-content`

### 0.4 구현 전략

1. **마이그레이션 생성**: CapsuleParticipantSlot에 필드 추가
2. **MediaService 확장**: multer 파일을 S3에 업로드하는 헬퍼 메서드
3. **기존 메서드 재사용**: `ensurePaidCapsuleContext()` 활용
4. **새로운 검증 로직**: 권한, 인원, 미디어 설정

## 1. 아키텍처 설계

### 1.1 컴포넌트 구조

```
capsules/
├── capsules.controller.ts (기존 파일 - 엔드포인트 추가)
├── capsules.service.ts (기존 파일 - 메서드 추가)
├── dto/
│   ├── save-content.dto.ts (새로 생성)
│   └── content-response.dto.ts (새로 생성)
migrations/
└── TIMESTAMP-add-slot-content-fields.ts (새로 생성)
```

### 1.2 의존성
- **CapsulesService**: 기존 서비스 확장
- **MediaService**: S3 파일 업로드 (헬퍼 메서드 추가)
- **TypeORM**: 데이터베이스 처리
- **JWT Guard**: 인증 처리
- **Multer**: 파일 업로드 처리

## 2. 데이터베이스 마이그레이션

### 2.1 CapsuleParticipantSlot 필드 추가

```typescript
// migrations/TIMESTAMP-add-slot-content-fields.ts
export class AddSlotContentFields implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // status enum 생성
    await queryRunner.query(`
      CREATE TYPE "capsule_participant_slots_status_enum" AS ENUM('PENDING', 'COMPLETED')
    `);

    // 컬럼 추가
    await queryRunner.query(`
      ALTER TABLE "capsule_participant_slots"
      ADD COLUMN "nickname" VARCHAR(50),
      ADD COLUMN "text_message" TEXT,
      ADD COLUMN "status" "capsule_participant_slots_status_enum" DEFAULT 'PENDING',
      ADD COLUMN "image_ids" uuid[],
      ADD COLUMN "music_id" uuid,
      ADD COLUMN "video_id" uuid
    `);

    // 외래 키 추가
    await queryRunner.query(`
      ALTER TABLE "capsule_participant_slots"
      ADD CONSTRAINT "FK_capsule_slots_music" 
      FOREIGN KEY ("music_id") REFERENCES "media"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "capsule_participant_slots"
      ADD CONSTRAINT "FK_capsule_slots_video" 
      FOREIGN KEY ("video_id") REFERENCES "media"("id") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "capsule_participant_slots"
      DROP CONSTRAINT IF EXISTS "FK_capsule_slots_video",
      DROP CONSTRAINT IF EXISTS "FK_capsule_slots_music",
      DROP COLUMN IF EXISTS "video_id",
      DROP COLUMN IF EXISTS "music_id",
      DROP COLUMN IF EXISTS "image_ids",
      DROP COLUMN IF EXISTS "status",
      DROP COLUMN IF EXISTS "text_message",
      DROP COLUMN IF EXISTS "nickname"
    `);
    
    await queryRunner.query(`
      DROP TYPE IF EXISTS "capsule_participant_slots_status_enum"
    `);
  }
}
```

### 2.2 CapsuleParticipantSlot 엔티티 업데이트

```typescript
// entities/capsule-participant-slot.entity.ts에 추가
@Column({ type: 'varchar', length: 50, nullable: true })
nickname: string | null;

@Column({ type: 'text', name: 'text_message', nullable: true })
textMessage: string | null;

@Column({
  type: 'enum',
  enum: ['PENDING', 'COMPLETED'],
  default: 'PENDING',
})
status: 'PENDING' | 'COMPLETED';

@Column({ type: 'uuid', array: true, name: 'image_ids', nullable: true })
imageIds: string[] | null;

@Column({ type: 'uuid', name: 'music_id', nullable: true })
musicId: string | null;

@Column({ type: 'uuid', name: 'video_id', nullable: true })
videoId: string | null;

@ManyToMany(() => Media)
@JoinTable({
  name: 'capsule_slot_images',
  joinColumn: { name: 'slot_id' },
  inverseJoinColumn: { name: 'media_id' },
})
images: Media[];

@ManyToOne(() => Media)
@JoinColumn({ name: 'music_id' })
music: Media | null;

@ManyToOne(() => Media)
@JoinColumn({ name: 'video_id' })
video: Media | null;
```

## 3. API 구현

### 3.1 Controller 메서드

```typescript
// capsules.controller.ts에 추가
@Post('step-rooms/:capsuleId/my-content')
@UseGuards(JwtAuthGuard)
@UseInterceptors(FileFieldsInterceptor([
  { name: 'images', maxCount: 5 },
  { name: 'music', maxCount: 1 },
  { name: 'video', maxCount: 1 },
]))
@ApiTags('Capsules')
@ApiBearerAuth('access-token')
@ApiOperation({ summary: '스텝룸 콘텐츠 저장' })
@ApiConsumes('multipart/form-data')
async saveMyContent(
  @Param('capsuleId', ParseUUIDPipe) capsuleId: string,
  @CurrentUser() user: User,
  @Body() saveContentDto: SaveContentDto,
  @UploadedFiles() files: {
    images?: Express.Multer.File[],
    music?: Express.Multer.File[],
    video?: Express.Multer.File[],
  },
): Promise<ContentResponseDto> {
  return this.capsulesService.saveMyContent(
    capsuleId,
    user.id,
    saveContentDto,
    files,
  );
}
```

### 3.2 DTO 정의

#### SaveContentDto

```typescript
export class SaveContentDto {
  @ApiProperty({ description: '텍스트 메시지', example: '안녕하세요!' })
  @IsString()
  @IsNotEmpty()
  text_message: string;

  @ApiProperty({ 
    description: '초대 코드 (선택)', 
    example: 'ABC123',
    required: false 
  })
  @IsString()
  @IsOptional()
  invite_code?: string;

  @ApiPropertyOptional({
    type: 'array',
    items: { type: 'string', format: 'binary' },
    description: '이미지 파일 (최대 5개)',
  })
  images?: Express.Multer.File[];

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: '음성 파일',
  })
  music?: Express.Multer.File;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: '동영상 파일',
  })
  video?: Express.Multer.File;
}
```

#### ContentResponseDto

```typescript
export class ContentResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  data: {
    user_id: string;
    nickname: string;
    status: string;
    saved_at: Date;
    uploaded_images: number;
    uploaded_music: boolean;
    uploaded_video: boolean;
  };
}
```

## 4. MediaService 헬퍼 메서드 추가

### 4.1 Multer 파일을 S3에 업로드

```typescript
// media.service.ts에 추가
/**
 * Multer로 받은 파일을 S3에 업로드하고 Media 엔티티 생성
 */
async uploadMulterFile(
  userId: string,
  file: Express.Multer.File,
  type: MediaType,
): Promise<Media> {
  // 1. Content Type 검증
  this.validateMulterFile(file, type);

  // 2. Object Key 생성
  const key = this.buildObjectKey(userId, type, file.originalname);

  // 3. S3에 업로드
  const command = new PutObjectCommand({
    Bucket: this.bucket,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
    ...(this.kmsKeyId
      ? { ServerSideEncryption: 'aws:kms', SSEKMSKeyId: this.kmsKeyId }
      : {}),
  });

  await this.s3.send(command);

  // 4. Media 엔티티 생성 및 저장
  const media = this.mediaRepo.create({
    userId,
    objectKey: key,
    type,
    contentType: file.mimetype,
    size: file.size,
  });

  return await this.mediaRepo.save(media);
}

/**
 * Multer 파일 검증
 */
private validateMulterFile(file: Express.Multer.File, type: MediaType): void {
  const isImage = type === MediaType.IMAGE;
  const isVideo = type === MediaType.VIDEO;
  const isAudio = type === MediaType.AUDIO;

  if (isImage && !IMAGE_TYPES.includes(file.mimetype)) {
    throw new BadRequestException('INVALID_IMAGE_TYPE');
  }
  if (isVideo && !VIDEO_TYPES.includes(file.mimetype)) {
    throw new BadRequestException('INVALID_VIDEO_TYPE');
  }
  if (isAudio && !AUDIO_TYPES.includes(file.mimetype)) {
    throw new BadRequestException('INVALID_AUDIO_TYPE');
  }

  if (isImage && file.size > IMAGE_MAX) {
    throw new BadRequestException('IMAGE_SIZE_EXCEEDED');
  }
  if (isVideo && file.size > VIDEO_MAX) {
    throw new BadRequestException('VIDEO_SIZE_EXCEEDED');
  }
  if (isAudio && file.size > AUDIO_MAX) {
    throw new BadRequestException('AUDIO_SIZE_EXCEEDED');
  }
}
```

## 5. Service 로직

### 5.1 메인 비즈니스 로직 (재사용 메서드 활용)

```typescript
// capsules.service.ts에 추가
async saveMyContent(
  capsuleId: string,
  userId: string,
  saveContentDto: SaveContentDto,
  files: {
    images?: Express.Multer.File[];
    music?: Express.Multer.File[];
    video?: Express.Multer.File[];
  },
): Promise<ContentResponseDto> {
  // 1. ✅ 재사용: ensurePaidCapsuleContext()
  const { capsule, order } = await this.ensurePaidCapsuleContext(capsuleId);
  
  // 2. 권한 검증 (새로 구현)
  await this.validateStepRoomAccess(capsule, userId, saveContentDto.invite_code);
  
  // 3. 인원 제한 검증 (새로 구현)
  await this.validateStepRoomParticipantLimit(capsule, userId);
  
  // 4. 미디어 설정 검증 (새로 구현)
  await this.validateStepRoomMediaSettings(capsule, order, files);
  
  // 5. 사용자 조회
  const user = await this.userRepository.findOne({ where: { id: userId } });
  if (!user) {
    throw new NotFoundException({
      success: false,
      error: 'USER_NOT_FOUND',
      message: '사용자를 찾을 수 없습니다',
    });
  }
  
  // 6. 콘텐츠 저장 (트랜잭션)
  return await this.saveStepRoomContentTransaction(
    capsule,
    userId,
    user,
    saveContentDto,
    files,
  );
}
```

### 5.2 검증 메서드 (새로 구현)

#### 5.2.1 권한 검증

```typescript
/**
 * 스텝룸 접근 권한 검증
 * - 캡슐 소유자
 * - 이미 참여 중인 사용자
 * - 초대코드를 가진 사용자
 */
private async validateStepRoomAccess(
  capsule: Capsule,
  userId: string,
  inviteCode?: string,
): Promise<void> {
  // 1. 캡슐 소유자인지 확인
  if (capsule.userId === userId) {
    return;
  }

  // 2. 이미 참여 슬롯이 있는지 확인
  const existingSlot = await this.slotRepository.findOne({
    where: { capsuleId: capsule.id, userId },
  });
  
  if (existingSlot) {
    return;
  }

  // 3. 초대코드 검증
  if (capsule.inviteCode && inviteCode === capsule.inviteCode) {
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

#### 5.2.2 인원 제한 검증

```typescript
/**
 * 스텝룸 인원 제한 검증
 */
private async validateStepRoomParticipantLimit(
  capsule: Capsule,
  userId: string,
): Promise<void> {
  // 1. 기존 슬롯이 있으면 인원 제한에서 제외 (재저장 케이스)
  const existingSlot = await this.slotRepository.findOne({
    where: { capsuleId: capsule.id, userId },
  });
  
  if (existingSlot) {
    return;
  }

  // 2. 현재 참여자 수 확인
  const currentParticipants = await this.slotRepository.count({
    where: { capsuleId: capsule.id, userId: Not(IsNull()) },
  });

  const maxParticipants = capsule.viewLimit;

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

#### 5.2.3 미디어 설정 검증

```typescript
/**
 * 스텝룸 미디어 설정 검증
 */
private async validateStepRoomMediaSettings(
  capsule: Capsule,
  order: Order,
  files: {
    images?: Express.Multer.File[];
    music?: Express.Multer.File[];
    video?: Express.Multer.File[];
  },
): Promise<void> {
  // 1. 음성 파일 검증
  if (files.music && files.music.length > 0 && !order.addMusic) {
    throw new BadRequestException({
      success: false,
      error: 'MUSIC_NOT_ALLOWED',
      message: '이 캡슐은 음성 추가를 허용하지 않습니다',
    });
  }

  // 2. 동영상 파일 검증
  if (files.video && files.video.length > 0 && !order.addVideo) {
    throw new BadRequestException({
      success: false,
      error: 'VIDEO_NOT_ALLOWED',
      message: '이 캡슐은 동영상 추가를 허용하지 않습니다',
    });
  }

  // 3. 이미지 개수 검증
  if (files.images && files.images.length > 0) {
    // 1인당 사진 개수 계산
    const maxImagesPerPerson = 
      order.headcount > 0 
        ? Math.floor(order.photoCount / order.headcount) 
        : 0;
    
    const uploadedCount = files.images.length;

    if (uploadedCount > maxImagesPerPerson) {
      throw new BadRequestException({
        success: false,
        error: 'IMAGE_LIMIT_EXCEEDED',
        message: `사진은 최대 ${maxImagesPerPerson}장까지 업로드할 수 있습니다`,
        data: {
          max_images: maxImagesPerPerson,
          uploaded_images: uploadedCount,
        },
      });
    }
  }
}
```

### 5.3 저장 로직 (트랜잭션)

```typescript
/**
 * 스텝룸 콘텐츠 저장 (트랜잭션)
 */
private async saveStepRoomContentTransaction(
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

    // 1. 기존 슬롯 확인
    let slot = await slotRepo.findOne({
      where: { capsuleId: capsule.id, userId },
    });

    // 2. 기존 미디어 삭제 (재저장 케이스)
    if (slot) {
      // 기존 이미지 ID 삭제 (Media 엔티티는 유지)
      slot.imageIds = null;
      slot.musicId = null;
      slot.videoId = null;
    } else {
      // 3. 새 슬롯 찾기 또는 생성
      // 빈 슬롯 찾기
      const emptySlot = await slotRepo.findOne({
        where: { capsuleId: capsule.id, userId: IsNull() },
        order: { slotIndex: 'ASC' },
      });

      if (emptySlot) {
        slot = emptySlot;
        slot.userId = userId;
        slot.assignedAt = new Date();
      } else {
        throw new ConflictException({
          success: false,
          error: 'SLOTS_FULL',
          message: '모든 슬롯이 이미 배정되었습니다',
        });
      }
    }

    // 4. 텍스트 메시지 저장
    slot.nickname = user.nickname || '익명';
    slot.textMessage = saveContentDto.text_message;

    // 5. 이미지 업로드 및 저장 (트랜잭션 외부에서 처리)
    const uploadedImageIds: string[] = [];
    if (files.images && files.images.length > 0) {
      for (const imageFile of files.images) {
        const media = await this.mediaService.uploadMulterFile(
          userId,
          imageFile,
          MediaType.IMAGE,
        );
        uploadedImageIds.push(media.id);
      }
    }
    slot.imageIds = uploadedImageIds.length > 0 ? uploadedImageIds : null;

    // 6. 음성 업로드 및 저장
    if (files.music && files.music.length > 0) {
      const media = await this.mediaService.uploadMulterFile(
        userId,
        files.music[0],
        MediaType.AUDIO,
      );
      slot.musicId = media.id;
    }

    // 7. 동영상 업로드 및 저장
    if (files.video && files.video.length > 0) {
      const media = await this.mediaService.uploadMulterFile(
        userId,
        files.video[0],
        MediaType.VIDEO,
      );
      slot.videoId = media.id;
    }

    // 8. 상태를 COMPLETED로 변경
    slot.status = 'COMPLETED';

    // 9. 슬롯 저장
    await slotRepo.save(slot);

    // 10. 응답 생성
    return {
      success: true,
      data: {
        user_id: userId,
        nickname: slot.nickname,
        status: slot.status,
        saved_at: slot.updatedAt,
        uploaded_images: uploadedImageIds.length,
        uploaded_music: !!slot.musicId,
        uploaded_video: !!slot.videoId,
      },
    };
  });
}
```

## 6. 파일 업로드 설정

### 6.1 Multer 설정

**참고**: Multer는 메모리 스토리지를 사용하여 파일을 buffer로 받습니다.

```typescript
// capsules.module.ts
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

@Module({
  imports: [
    MulterModule.register({
      storage: memoryStorage(),
      limits: {
        fileSize: 200 * 1024 * 1024, // 200MB (동영상 최대 크기)
      },
    }),
  ],
})
```

### 6.2 파일 크기 제한 (MediaService에서 검증)

- **이미지**: 5MB (MediaService 기준)
- **음성**: 20MB (MediaService 기준)
- **동영상**: 200MB (MediaService 기준)

## 7. 에러 처리

### 7.1 에러 코드 목록

- `CAPSULE_NOT_FOUND`: 캡슐을 찾을 수 없음 (404)
- `CAPSULE_PAYMENT_REQUIRED`: 결제가 완료되지 않음 (403) - ✅ ensurePaidCapsuleContext에서 자동 처리
- `UNAUTHORIZED_ACCESS`: 권한 없음 (403)
- `PARTICIPANT_LIMIT_EXCEEDED`: 인원 초과 (403)
- `SLOTS_FULL`: 모든 슬롯이 배정됨 (409)
- `MUSIC_NOT_ALLOWED`: 음성 업로드 불가 (400)
- `VIDEO_NOT_ALLOWED`: 동영상 업로드 불가 (400)
- `IMAGE_LIMIT_EXCEEDED`: 이미지 개수 초과 (400)
- `INVALID_IMAGE_TYPE`: 이미지 타입 오류 (400)
- `INVALID_VIDEO_TYPE`: 동영상 타입 오류 (400)
- `INVALID_AUDIO_TYPE`: 음성 타입 오류 (400)
- `IMAGE_SIZE_EXCEEDED`: 이미지 크기 초과 (400)
- `VIDEO_SIZE_EXCEEDED`: 동영상 크기 초과 (400)
- `AUDIO_SIZE_EXCEEDED`: 음성 크기 초과 (400)
- `USER_NOT_FOUND`: 사용자를 찾을 수 없음 (404)

## 8. Swagger 문서화

### 8.1 API 문서 예시

Controller 메서드에 이미 적용됨 (3.1 참고)

## 9. 테스트 계획

### 9.1 단위 테스트

- `validateStepRoomAccess()`: 권한 검증
- `validateStepRoomParticipantLimit()`: 인원 제한 검증
- `validateStepRoomMediaSettings()`: 미디어 설정 검증
- MediaService의 `uploadMulterFile()`: 파일 업로드

### 9.2 통합 테스트

- 새로운 콘텐츠 저장 시나리오
- 기존 콘텐츠 재저장 시나리오
- 각종 에러 케이스 시나리오

### 9.3 E2E 테스트 (Playwright)

```typescript
test('should save content successfully', async ({ request }) => {
  // 1. 캡슐 생성 및 결제
  // 2. 콘텐츠 저장
  // 3. 응답 검증
});

test('should reject when payment is not completed', async ({ request }) => {
  // 1. 캡슐 생성 (결제 안함)
  // 2. 콘텐츠 저장 시도
  // 3. 403 에러 검증
});

test('should reject when participant limit exceeded', async ({ request }) => {
  // 1. 인원 제한이 있는 캡슐 생성
  // 2. 인원만큼 콘텐츠 저장
  // 3. 추가 저장 시도
  // 4. 403 에러 검증
});
```

## 10. 보안 고려사항

### 10.1 인증 및 권한

- JWT 토큰 검증
- 캡슐 접근 권한 확인
- 초대코드 검증

### 10.2 파일 업로드 보안

- ✅ MIME 타입 검증 (MediaService에서 처리)
- ✅ 파일 크기 제한 (MediaService에서 처리)
- S3에 업로드하므로 서버 파일시스템 안전
- 악성 코드 스캔 (향후)

### 10.3 데이터 검증

- DTO 유효성 검사
- SQL Injection 방지 (TypeORM 사용)
- XSS 방지 (텍스트 이스케이프)

## 11. 성능 최적화

### 11.1 데이터베이스 쿼리 최적화

- ✅ `ensurePaidCapsuleContext()` 재사용으로 쿼리 최적화
- 필요한 relations만 로드
- 인덱스 활용 (capsule_id, user_id)

### 11.2 파일 업로드 최적화

- ✅ S3 직접 업로드로 서버 부하 감소
- 비동기 업로드 처리
- 압축 처리 (향후)

### 11.3 트랜잭션 최적화

- 파일 업로드는 트랜잭션 외부에서 처리
- 트랜잭션은 DB 작업만 포함

## 12. 구현 순서

### Phase 1: 데이터베이스 및 엔티티 (30분)
1. ✅ 마이그레이션 생성: CapsuleParticipantSlot 필드 추가
2. ✅ 엔티티 업데이트: CapsuleParticipantSlot

### Phase 2: MediaService 확장 (30분)
3. ✅ `uploadMulterFile()` 메서드 구현
4. ✅ `validateMulterFile()` 메서드 구현

### Phase 3: DTO 생성 (30분)
5. ✅ `SaveContentDto` 생성
6. ✅ `ContentResponseDto` 생성

### Phase 4: Service 로직 (2시간)
7. ✅ `validateStepRoomAccess()` 구현
8. ✅ `validateStepRoomParticipantLimit()` 구현
9. ✅ `validateStepRoomMediaSettings()` 구현
10. ✅ `saveStepRoomContentTransaction()` 구현
11. ✅ `saveMyContent()` 메인 메서드 구현

### Phase 5: Controller (40분)
12. ✅ `saveMyContent()` 엔드포인트 추가
13. ✅ Swagger 문서화

### Phase 6: 테스트 (1시간)
14. ✅ E2E 테스트 작성
15. ✅ 테스트 실행 및 디버깅

**총 예상 소요 시간**: 5시간

## 13. 배포 고려사항

### 13.1 환경 변수

기존 환경 변수 활용:
- `S3_BUCKET`: S3 버킷명
- `AWS_REGION`: AWS 리전
- `S3_KMS_KEY_ID`: KMS 키 (암호화)

### 13.2 서버 설정

- Nginx 파일 업로드 크기 제한: 200MB
- Node.js 메모리 제한 설정

## 14. 모니터링

### 14.1 로깅

- 파일 업로드 성공/실패 로그
- 검증 실패 로그
- 에러 로그

### 14.2 메트릭

- 콘텐츠 저장 요청 수
- 파일 업로드 성공률
- 평균 응답 시간

## 15. 문서화

- ✅ API 문서 (Swagger)
- 에러 코드 가이드
- 파일 업로드 가이드

## 16. 재사용 요약

### ✅ 재사용하는 메서드
1. `ensurePaidCapsuleContext()`: 캡슐 조회 + 결제 검증
2. MediaService 기존 메서드: S3 업로드 로직 활용

### 🆕 새로 구현하는 메서드
1. MediaService.`uploadMulterFile()`: multer 파일 S3 업로드
2. CapsuleService.`validateStepRoomAccess()`: 스텝룸 권한 검증
3. CapsuleService.`validateStepRoomParticipantLimit()`: 인원 제한 검증
4. CapsuleService.`validateStepRoomMediaSettings()`: 미디어 설정 검증
5. CapsuleService.`saveStepRoomContentTransaction()`: 콘텐츠 저장
6. CapsuleService.`saveMyContent()`: 메인 비즈니스 로직

### 📦 새로 생성하는 파일
1. `migrations/TIMESTAMP-add-slot-content-fields.ts`
2. `dto/save-content.dto.ts`
3. `dto/content-response.dto.ts`
4. `tests/playwright/step-room-content.spec.ts`

### ✏️ 수정하는 파일
1. `entities/capsule-participant-slot.entity.ts`: 필드 추가
2. `capsules.controller.ts`: 엔드포인트 추가
3. `capsules.service.ts`: 메서드 추가
4. `media.service.ts`: `uploadMulterFile()` 추가

