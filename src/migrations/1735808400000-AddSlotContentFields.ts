import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSlotContentFields1735808400000 implements MigrationInterface {
  name = 'AddSlotContentFields1735808400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // status enum 생성 (이미 있으면 생략)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type t
          JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE t.typname = 'capsule_participant_slots_status_enum'
            AND n.nspname = 'public'
        ) THEN
          CREATE TYPE "capsule_participant_slots_status_enum" AS ENUM('PENDING', 'COMPLETED');
        END IF;
      END
      $$;
    `);

    // 컬럼 추가
    await queryRunner.query(`
      ALTER TABLE "capsule_participant_slots"
      ADD COLUMN IF NOT EXISTS "nickname" VARCHAR(50),
      ADD COLUMN IF NOT EXISTS "text_message" TEXT,
      ADD COLUMN IF NOT EXISTS "status" "capsule_participant_slots_status_enum" DEFAULT 'PENDING',
      ADD COLUMN IF NOT EXISTS "image_ids" uuid[],
      ADD COLUMN IF NOT EXISTS "music_id" uuid,
      ADD COLUMN IF NOT EXISTS "video_id" uuid
    `);

    // 외래 키 추가
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_capsule_slots_music'
        ) THEN
          ALTER TABLE "capsule_participant_slots"
          ADD CONSTRAINT "FK_capsule_slots_music" 
          FOREIGN KEY ("music_id") REFERENCES "media"("id") ON DELETE SET NULL;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_capsule_slots_video'
        ) THEN
          ALTER TABLE "capsule_participant_slots"
          ADD CONSTRAINT "FK_capsule_slots_video" 
          FOREIGN KEY ("video_id") REFERENCES "media"("id") ON DELETE SET NULL;
        END IF;
      END
      $$;
    `);

    // 컬럼 코멘트 추가
    await queryRunner.query(`
      COMMENT ON COLUMN "capsule_participant_slots"."nickname" IS '참여자 닉네임 (저장 시점 스냅샷)'
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN "capsule_participant_slots"."text_message" IS '참여자가 작성한 텍스트 메시지'
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN "capsule_participant_slots"."status" IS '작성 상태 (PENDING: 미작성, COMPLETED: 작성완료)'
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN "capsule_participant_slots"."image_ids" IS '업로드된 이미지 Media ID 배열'
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN "capsule_participant_slots"."music_id" IS '업로드된 음성 Media ID'
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN "capsule_participant_slots"."video_id" IS '업로드된 동영상 Media ID'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 외래 키 제거
    await queryRunner.query(`
      ALTER TABLE "capsule_participant_slots"
      DROP CONSTRAINT IF EXISTS "FK_capsule_slots_video"
    `);

    await queryRunner.query(`
      ALTER TABLE "capsule_participant_slots"
      DROP CONSTRAINT IF EXISTS "FK_capsule_slots_music"
    `);

    // 컬럼 제거
    await queryRunner.query(`
      ALTER TABLE "capsule_participant_slots"
      DROP COLUMN IF EXISTS "video_id",
      DROP COLUMN IF EXISTS "music_id",
      DROP COLUMN IF EXISTS "image_ids",
      DROP COLUMN IF EXISTS "status",
      DROP COLUMN IF EXISTS "text_message",
      DROP COLUMN IF EXISTS "nickname"
    `);

    // Enum 제거
    await queryRunner.query(`
      DROP TYPE IF EXISTS "capsule_participant_slots_status_enum"
    `);
  }
}
