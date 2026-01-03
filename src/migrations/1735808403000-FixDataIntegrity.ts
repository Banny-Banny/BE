import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixDataIntegrity1735808403000 implements MigrationInterface {
  name = 'FixDataIntegrity1735808403000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. orders 테이블에 deleted_at 추가 (soft delete)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'orders' AND column_name = 'deleted_at'
        ) THEN
          ALTER TABLE "orders"
          ADD COLUMN "deleted_at" TIMESTAMP NULL;
          COMMENT ON COLUMN "orders"."deleted_at" IS 'Soft Delete (재무 데이터 보존)';
        END IF;
      END
      $$;
    `);

    // 2. payments 테이블에 deleted_at 추가 (soft delete)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'payments' AND column_name = 'deleted_at'
        ) THEN
          ALTER TABLE "payments"
          ADD COLUMN "deleted_at" TIMESTAMP NULL;
          COMMENT ON COLUMN "payments"."deleted_at" IS 'Soft Delete (재무 데이터 보존)';
        END IF;
      END
      $$;
    `);

    // 3. payments FK를 CASCADE에서 RESTRICT로 변경
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'FK_payments_order'
        ) THEN
          ALTER TABLE "payments" DROP CONSTRAINT "FK_payments_order";
        END IF;
        
        ALTER TABLE "payments"
        ADD CONSTRAINT "FK_payments_order"
        FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT;
      END
      $$;
    `);

    // 4. capsule_participant_slots.user_id FK를 SET NULL에서 CASCADE로 변경
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'FK_capsule_slots_user'
        ) THEN
          ALTER TABLE "capsule_participant_slots" DROP CONSTRAINT "FK_capsule_slots_user";
        END IF;
        
        ALTER TABLE "capsule_participant_slots"
        ADD CONSTRAINT "FK_capsule_slots_user"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
      END
      $$;
    `);

    // 5. friendships에 CHECK 제약 추가 (user_id < friend_id)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'CHK_friendships_ordered_ids'
        ) THEN
          ALTER TABLE "friendships"
          ADD CONSTRAINT "CHK_friendships_ordered_ids" CHECK (user_id < friend_id);
        END IF;
      END
      $$;
    `);

    // 6. capsules.media_urls는 향후 단계적 제거 예정 (현재는 deprecated 유지)
    await queryRunner.query(`
      COMMENT ON COLUMN "capsules"."media_urls" IS '[DEPRECATED] 향후 제거 예정. media_item_ids 사용 권장';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. friendships CHECK 제약 제거
    await queryRunner.query(`
      ALTER TABLE "friendships" DROP CONSTRAINT IF EXISTS "CHK_friendships_ordered_ids";
    `);

    // 4. FK 복원
    await queryRunner.query(`
      ALTER TABLE "capsule_participant_slots" DROP CONSTRAINT IF EXISTS "FK_capsule_slots_user";
      ALTER TABLE "capsule_participant_slots"
      ADD CONSTRAINT "FK_capsule_slots_user"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "FK_payments_order";
      ALTER TABLE "payments"
      ADD CONSTRAINT "FK_payments_order"
      FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE;
    `);

    // 5. soft delete 컬럼 제거
    await queryRunner.query(`
      ALTER TABLE "payments" DROP COLUMN IF EXISTS "deleted_at";
    `);

    await queryRunner.query(`
      ALTER TABLE "orders" DROP COLUMN IF EXISTS "deleted_at";
    `);
  }
}
