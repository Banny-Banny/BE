import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCapsuleEntryAndSlots1700000001000 implements MigrationInterface {
  name = 'AddCapsuleEntryAndSlots1700000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enum: 이미 있으면 건너뛰기
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type t
          JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE t.typname = 'capsule_entries_media_types_enum'
            AND n.nspname = 'public'
        ) THEN
          CREATE TYPE "public"."capsule_entries_media_types_enum" AS ENUM('TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'MUSIC');
        END IF;
      END
      $$;
    `);

    // participant_slots 테이블 생성 (없을 때만)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "capsule_participant_slots" (
        "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        "capsule_id" uuid NOT NULL,
        "slot_index" integer NOT NULL,
        "user_id" uuid NULL,
        "assigned_at" TIMESTAMP NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now()
      );
    `);

    // 유니크 제약 조건 보강
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'UQ_capsule_slots_capsule_slot_index'
        ) THEN
          ALTER TABLE "capsule_participant_slots"
          ADD CONSTRAINT "UQ_capsule_slots_capsule_slot_index" UNIQUE ("capsule_id", "slot_index");
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'UQ_capsule_slots_capsule_user'
        ) THEN
          ALTER TABLE "capsule_participant_slots"
          ADD CONSTRAINT "UQ_capsule_slots_capsule_user" UNIQUE ("capsule_id", "user_id");
        END IF;
      END
      $$;
    `);

    // entries 테이블 생성 (없을 때만)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "capsule_entries" (
        "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        "capsule_id" uuid NOT NULL,
        "slot_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "content" text NOT NULL,
        "media_item_ids" uuid[] NULL,
        "media_types" "public"."capsule_entries_media_types_enum"[] NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now()
      );
    `);

    // 유니크 제약 조건 보강
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'UQ_capsule_entries_capsule_user'
        ) THEN
          ALTER TABLE "capsule_entries"
          ADD CONSTRAINT "UQ_capsule_entries_capsule_user" UNIQUE ("capsule_id", "user_id");
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'UQ_capsule_entries_slot'
        ) THEN
          ALTER TABLE "capsule_entries"
          ADD CONSTRAINT "UQ_capsule_entries_slot" UNIQUE ("slot_id");
        END IF;
      END
      $$;
    `);

    // FK 추가 (없을 때만)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_capsule_slots_capsule'
        ) THEN
          ALTER TABLE "capsule_participant_slots"
          ADD CONSTRAINT "FK_capsule_slots_capsule" FOREIGN KEY ("capsule_id") REFERENCES "capsules"("id") ON DELETE CASCADE;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_capsule_slots_user'
        ) THEN
          ALTER TABLE "capsule_participant_slots"
          ADD CONSTRAINT "FK_capsule_slots_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_capsule_entries_capsule'
        ) THEN
          ALTER TABLE "capsule_entries"
          ADD CONSTRAINT "FK_capsule_entries_capsule" FOREIGN KEY ("capsule_id") REFERENCES "capsules"("id") ON DELETE CASCADE;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_capsule_entries_slot'
        ) THEN
          ALTER TABLE "capsule_entries"
          ADD CONSTRAINT "FK_capsule_entries_slot" FOREIGN KEY ("slot_id") REFERENCES "capsule_participant_slots"("id") ON DELETE CASCADE;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_capsule_entries_user'
        ) THEN
          ALTER TABLE "capsule_entries"
          ADD CONSTRAINT "FK_capsule_entries_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_capsule_entries_user') THEN
          ALTER TABLE "capsule_entries" DROP CONSTRAINT "FK_capsule_entries_user";
        END IF;
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_capsule_entries_slot') THEN
          ALTER TABLE "capsule_entries" DROP CONSTRAINT "FK_capsule_entries_slot";
        END IF;
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_capsule_entries_capsule') THEN
          ALTER TABLE "capsule_entries" DROP CONSTRAINT "FK_capsule_entries_capsule";
        END IF;
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_capsule_slots_user') THEN
          ALTER TABLE "capsule_participant_slots" DROP CONSTRAINT "FK_capsule_slots_user";
        END IF;
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_capsule_slots_capsule') THEN
          ALTER TABLE "capsule_participant_slots" DROP CONSTRAINT "FK_capsule_slots_capsule";
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS "capsule_entries";`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS "capsule_participant_slots";`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."capsule_entries_media_types_enum";`,
    );
  }
}
