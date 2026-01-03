import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 외래키를 일괄 복원/보강하는 마이그레이션.
 * 기존에 FK가 존재하면 건너뛰도록 방어적으로 작성됨.
 */
export class AddForeignKeys1735808402000 implements MigrationInterface {
  name = 'AddForeignKeys1735808402000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        -- capsules
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_capsules_user') THEN
          ALTER TABLE "capsules" ADD CONSTRAINT "FK_capsules_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_capsules_product') THEN
          ALTER TABLE "capsules" ADD CONSTRAINT "FK_capsules_product" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_capsules_order') THEN
          ALTER TABLE "capsules" ADD CONSTRAINT "FK_capsules_order" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL;
        END IF;

        -- capsule_access_logs
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_capsule_logs_capsule') THEN
          ALTER TABLE "capsule_access_logs" ADD CONSTRAINT "FK_capsule_logs_capsule" FOREIGN KEY ("capsule_id") REFERENCES "capsules"("id") ON DELETE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_capsule_logs_viewer') THEN
          ALTER TABLE "capsule_access_logs" ADD CONSTRAINT "FK_capsule_logs_viewer" FOREIGN KEY ("viewer_id") REFERENCES "users"("id") ON DELETE CASCADE;
        END IF;

        -- capsule_participant_slots
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_capsule_slots_capsule') THEN
          ALTER TABLE "capsule_participant_slots" ADD CONSTRAINT "FK_capsule_slots_capsule" FOREIGN KEY ("capsule_id") REFERENCES "capsules"("id") ON DELETE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_capsule_slots_user') THEN
          ALTER TABLE "capsule_participant_slots" ADD CONSTRAINT "FK_capsule_slots_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_capsule_slots_music') THEN
          ALTER TABLE "capsule_participant_slots" ADD CONSTRAINT "FK_capsule_slots_music" FOREIGN KEY ("music_id") REFERENCES "media"("id") ON DELETE SET NULL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_capsule_slots_video') THEN
          ALTER TABLE "capsule_participant_slots" ADD CONSTRAINT "FK_capsule_slots_video" FOREIGN KEY ("video_id") REFERENCES "media"("id") ON DELETE SET NULL;
        END IF;

        -- capsule_entries
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_capsule_entries_capsule') THEN
          ALTER TABLE "capsule_entries" ADD CONSTRAINT "FK_capsule_entries_capsule" FOREIGN KEY ("capsule_id") REFERENCES "capsules"("id") ON DELETE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_capsule_entries_slot') THEN
          ALTER TABLE "capsule_entries" ADD CONSTRAINT "FK_capsule_entries_slot" FOREIGN KEY ("slot_id") REFERENCES "capsule_participant_slots"("id") ON DELETE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_capsule_entries_user') THEN
          ALTER TABLE "capsule_entries" ADD CONSTRAINT "FK_capsule_entries_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
        END IF;

        -- orders
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_orders_user') THEN
          ALTER TABLE "orders" ADD CONSTRAINT "FK_orders_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_orders_product') THEN
          ALTER TABLE "orders" ADD CONSTRAINT "FK_orders_product" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT;
        END IF;

        -- payments
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_payments_order') THEN
          ALTER TABLE "payments" ADD CONSTRAINT "FK_payments_order" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE;
        END IF;

        -- payment_cancels
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_payment_cancels_payment') THEN
          ALTER TABLE "payment_cancels" ADD CONSTRAINT "FK_payment_cancels_payment" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE;
        END IF;

        -- media
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_media_user') THEN
          ALTER TABLE "media" ADD CONSTRAINT "FK_media_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
        END IF;

        -- friendships
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_friendships_user') THEN
          ALTER TABLE "friendships" ADD CONSTRAINT "FK_friendships_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_friendships_friend') THEN
          ALTER TABLE "friendships" ADD CONSTRAINT "FK_friendships_friend" FOREIGN KEY ("friend_id") REFERENCES "users"("id") ON DELETE CASCADE;
        END IF;

        -- customer_services
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_customer_services_user') THEN
          ALTER TABLE "customer_services" ADD CONSTRAINT "FK_customer_services_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        -- customer_services
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_customer_services_user') THEN
          ALTER TABLE "customer_services" DROP CONSTRAINT "FK_customer_services_user";
        END IF;

        -- friendships
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_friendships_friend') THEN
          ALTER TABLE "friendships" DROP CONSTRAINT "FK_friendships_friend";
        END IF;
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_friendships_user') THEN
          ALTER TABLE "friendships" DROP CONSTRAINT "FK_friendships_user";
        END IF;

        -- media
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_media_user') THEN
          ALTER TABLE "media" DROP CONSTRAINT "FK_media_user";
        END IF;

        -- payment_cancels
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_payment_cancels_payment') THEN
          ALTER TABLE "payment_cancels" DROP CONSTRAINT "FK_payment_cancels_payment";
        END IF;

        -- payments
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_payments_order') THEN
          ALTER TABLE "payments" DROP CONSTRAINT "FK_payments_order";
        END IF;

        -- orders
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_orders_product') THEN
          ALTER TABLE "orders" DROP CONSTRAINT "FK_orders_product";
        END IF;
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_orders_user') THEN
          ALTER TABLE "orders" DROP CONSTRAINT "FK_orders_user";
        END IF;

        -- capsule_entries
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_capsule_entries_user') THEN
          ALTER TABLE "capsule_entries" DROP CONSTRAINT "FK_capsule_entries_user";
        END IF;
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_capsule_entries_slot') THEN
          ALTER TABLE "capsule_entries" DROP CONSTRAINT "FK_capsule_entries_slot";
        END IF;
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_capsule_entries_capsule') THEN
          ALTER TABLE "capsule_entries" DROP CONSTRAINT "FK_capsule_entries_capsule";
        END IF;

        -- capsule_participant_slots
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_capsule_slots_video') THEN
          ALTER TABLE "capsule_participant_slots" DROP CONSTRAINT "FK_capsule_slots_video";
        END IF;
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_capsule_slots_music') THEN
          ALTER TABLE "capsule_participant_slots" DROP CONSTRAINT "FK_capsule_slots_music";
        END IF;
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_capsule_slots_user') THEN
          ALTER TABLE "capsule_participant_slots" DROP CONSTRAINT "FK_capsule_slots_user";
        END IF;
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_capsule_slots_capsule') THEN
          ALTER TABLE "capsule_participant_slots" DROP CONSTRAINT "FK_capsule_slots_capsule";
        END IF;

        -- capsule_access_logs
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_capsule_logs_viewer') THEN
          ALTER TABLE "capsule_access_logs" DROP CONSTRAINT "FK_capsule_logs_viewer";
        END IF;
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_capsule_logs_capsule') THEN
          ALTER TABLE "capsule_access_logs" DROP CONSTRAINT "FK_capsule_logs_capsule";
        END IF;

        -- capsules
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_capsules_order') THEN
          ALTER TABLE "capsules" DROP CONSTRAINT "FK_capsules_order";
        END IF;
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_capsules_product') THEN
          ALTER TABLE "capsules" DROP CONSTRAINT "FK_capsules_product";
        END IF;
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_capsules_user') THEN
          ALTER TABLE "capsules" DROP CONSTRAINT "FK_capsules_user";
        END IF;
      END
      $$;
    `);
  }
}
