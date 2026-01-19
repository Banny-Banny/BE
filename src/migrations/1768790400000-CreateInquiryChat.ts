import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 1:1 문의 채팅 테이블 및 컬럼 추가
 */
export class CreateInquiryChat1768790400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inquiry_status') THEN
          CREATE TYPE inquiry_status AS ENUM ('PENDING', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inquiry_sender_type') THEN
          CREATE TYPE inquiry_sender_type AS ENUM ('USER', 'ADMIN');
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "customer_services"
        ADD COLUMN IF NOT EXISTS "status" inquiry_status NOT NULL DEFAULT 'PENDING',
        ADD COLUMN IF NOT EXISTS "last_message_at" TIMESTAMP NULL,
        ADD COLUMN IF NOT EXISTS "last_message_preview" VARCHAR(200) NULL,
        ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP NULL;
    `);

    await queryRunner.query(`
      UPDATE "customer_services"
      SET last_message_at = COALESCE(last_message_at, updated_at, created_at);
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "customer_service_messages" (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        customer_service_id uuid NOT NULL,
        sender_type inquiry_sender_type NOT NULL,
        sender_user_id uuid NULL,
        sender_admin_id uuid NULL,
        content text NOT NULL,
        is_read_by_admin boolean NOT NULL DEFAULT false,
        is_read_by_user boolean NOT NULL DEFAULT false,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NULL,
        deleted_at TIMESTAMP NULL
      );
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_customer_service_messages_inquiry') THEN
          ALTER TABLE "customer_service_messages"
            ADD CONSTRAINT "FK_customer_service_messages_inquiry"
            FOREIGN KEY ("customer_service_id") REFERENCES "customer_services"("id")
            ON DELETE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_customer_service_messages_user') THEN
          ALTER TABLE "customer_service_messages"
            ADD CONSTRAINT "FK_customer_service_messages_user"
            FOREIGN KEY ("sender_user_id") REFERENCES "users"("id")
            ON DELETE SET NULL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_customer_service_messages_admin') THEN
          ALTER TABLE "customer_service_messages"
            ADD CONSTRAINT "FK_customer_service_messages_admin"
            FOREIGN KEY ("sender_admin_id") REFERENCES "admin_users"("id")
            ON DELETE SET NULL;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_customer_service_messages_room"
      ON "customer_service_messages" ("customer_service_id");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_customer_service_messages_created_at"
      ON "customer_service_messages" ("created_at");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS "customer_service_messages";
    `);

    await queryRunner.query(`
      ALTER TABLE "customer_services"
        DROP COLUMN IF EXISTS "status",
        DROP COLUMN IF EXISTS "last_message_at",
        DROP COLUMN IF EXISTS "last_message_preview",
        DROP COLUMN IF EXISTS "deleted_at";
    `);

    await queryRunner.query(`
      DROP TYPE IF EXISTS inquiry_sender_type;
    `);

    await queryRunner.query(`
      DROP TYPE IF EXISTS inquiry_status;
    `);
  }
}
