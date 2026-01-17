import { MigrationInterface, QueryRunner } from 'typeorm';

export class SplitCapsuleSchema1735840000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) capsule_type enum + 컬럼 추가
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'capsules_capsule_type_enum') THEN
          CREATE TYPE "capsules_capsule_type_enum" AS ENUM ('TIME_CAPSULE', 'EASTER_EGG');
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      ALTER TABLE "capsules"
      ADD COLUMN IF NOT EXISTS "capsule_type" "capsules_capsule_type_enum"
      NOT NULL DEFAULT 'EASTER_EGG'
    `);

    // 2) time_capsules table
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'time_capsules_room_status_enum') THEN
          CREATE TYPE "time_capsules_room_status_enum" AS ENUM ('WAITING', 'COMPLETED', 'EXPIRED', 'BURIED');
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "time_capsules" (
        "capsule_id" uuid PRIMARY KEY,
        "order_id" uuid UNIQUE NOT NULL,
        "open_at" TIMESTAMP NULL,
        "is_locked" BOOLEAN DEFAULT true,
        "invite_code" VARCHAR(6) UNIQUE NULL,
        "deadline" TIMESTAMP NULL,
        "room_status" "time_capsules_room_status_enum" NULL,
        "buried_at" TIMESTAMP NULL,
        "is_auto_submitted" BOOLEAN DEFAULT false
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "time_capsules"
      ADD CONSTRAINT "fk_time_capsules_capsule"
      FOREIGN KEY ("capsule_id") REFERENCES "capsules" ("id")
      ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "time_capsules"
      ADD CONSTRAINT "fk_time_capsules_order"
      FOREIGN KEY ("order_id") REFERENCES "orders" ("id")
      ON DELETE RESTRICT
    `);

    // 3) easter_eggs table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "easter_eggs" (
        "capsule_id" uuid PRIMARY KEY,
        "view_limit" INT DEFAULT 0,
        "view_count" INT DEFAULT 0
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "easter_eggs"
      ADD CONSTRAINT "fk_easter_eggs_capsule"
      FOREIGN KEY ("capsule_id") REFERENCES "capsules" ("id")
      ON DELETE CASCADE
    `);

    // 4) capsule_type 세팅 및 데이터 이관
    await queryRunner.query(`
      UPDATE "capsules"
      SET "capsule_type" = 'TIME_CAPSULE'
      WHERE "order_id" IS NOT NULL
    `);

    await queryRunner.query(`
      INSERT INTO "time_capsules" (
        "capsule_id",
        "order_id",
        "open_at",
        "is_locked",
        "invite_code",
        "deadline",
        "room_status",
        "buried_at",
        "is_auto_submitted"
      )
      SELECT
        "id",
        "order_id",
        "open_at",
        "is_locked",
        "invite_code",
        "deadline",
        "room_status"::text::"time_capsules_room_status_enum",
        "buried_at",
        "is_auto_submitted"
      FROM "capsules"
      WHERE "order_id" IS NOT NULL
    `);

    await queryRunner.query(`
      INSERT INTO "easter_eggs" (
        "capsule_id",
        "view_limit",
        "view_count"
      )
      SELECT
        "id",
        "view_limit",
        "view_count"
      FROM "capsules"
      WHERE "order_id" IS NULL
    `);

    // 5) 기존 컬럼 제거
    await queryRunner.query(`
      ALTER TABLE "capsules"
      DROP COLUMN IF EXISTS "product_id",
      DROP COLUMN IF EXISTS "order_id",
      DROP COLUMN IF EXISTS "open_at",
      DROP COLUMN IF EXISTS "is_locked",
      DROP COLUMN IF EXISTS "view_limit",
      DROP COLUMN IF EXISTS "view_count",
      DROP COLUMN IF EXISTS "invite_code",
      DROP COLUMN IF EXISTS "deadline",
      DROP COLUMN IF EXISTS "room_status",
      DROP COLUMN IF EXISTS "buried_at",
      DROP COLUMN IF EXISTS "is_auto_submitted"
    `);

    // 6) users.name 추가
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "name" VARCHAR(50) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1) capsules 컬럼 복원
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'capsules_room_status_enum') THEN
          CREATE TYPE "capsules_room_status_enum" AS ENUM ('WAITING', 'COMPLETED', 'EXPIRED', 'BURIED');
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      ALTER TABLE "capsules"
      ADD COLUMN IF NOT EXISTS "product_id" uuid NULL,
      ADD COLUMN IF NOT EXISTS "order_id" uuid NULL,
      ADD COLUMN IF NOT EXISTS "open_at" TIMESTAMP NULL,
      ADD COLUMN IF NOT EXISTS "is_locked" BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS "view_limit" INT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "view_count" INT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "invite_code" VARCHAR(6) UNIQUE NULL,
      ADD COLUMN IF NOT EXISTS "deadline" TIMESTAMP NULL,
      ADD COLUMN IF NOT EXISTS "room_status" "capsules_room_status_enum" NULL,
      ADD COLUMN IF NOT EXISTS "buried_at" TIMESTAMP NULL,
      ADD COLUMN IF NOT EXISTS "is_auto_submitted" BOOLEAN DEFAULT false
    `);

    // 2) 데이터 역이관
    await queryRunner.query(`
      UPDATE "capsules" c
      SET
        "order_id" = tc.order_id,
        "open_at" = tc.open_at,
        "is_locked" = tc.is_locked,
        "invite_code" = tc.invite_code,
        "deadline" = tc.deadline,
        "room_status" = tc.room_status::text::"capsules_room_status_enum",
        "buried_at" = tc.buried_at,
        "is_auto_submitted" = tc.is_auto_submitted
      FROM "time_capsules" tc
      WHERE c.id = tc.capsule_id
    `);

    await queryRunner.query(`
      UPDATE "capsules" c
      SET
        "view_limit" = ee.view_limit,
        "view_count" = ee.view_count
      FROM "easter_eggs" ee
      WHERE c.id = ee.capsule_id
    `);

    // 3) 신규 테이블 삭제
    await queryRunner.query(`DROP TABLE IF EXISTS "time_capsules"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "easter_eggs"`);

    // 4) capsule_type 제거
    await queryRunner.query(`
      ALTER TABLE "capsules"
      DROP COLUMN IF EXISTS "capsule_type"
    `);

    // 5) users.name 제거
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "name"
    `);
  }
}
