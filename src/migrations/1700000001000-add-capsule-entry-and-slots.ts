import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCapsuleEntryAndSlots1700000001000
  implements MigrationInterface
{
  name = 'AddCapsuleEntryAndSlots1700000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."capsule_entries_media_types_enum" AS ENUM('TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'MUSIC');
    `);

    await queryRunner.query(`
      CREATE TABLE "capsule_participant_slots" (
        "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        "capsule_id" uuid NOT NULL,
        "slot_index" integer NOT NULL,
        "user_id" uuid NULL,
        "assigned_at" TIMESTAMP NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_capsule_slots_capsule_slot_index" UNIQUE ("capsule_id", "slot_index"),
        CONSTRAINT "UQ_capsule_slots_capsule_user" UNIQUE ("capsule_id", "user_id")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "capsule_entries" (
        "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        "capsule_id" uuid NOT NULL,
        "slot_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "content" text NOT NULL,
        "media_item_ids" uuid[] NULL,
        "media_types" "public"."capsule_entries_media_types_enum"[] NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_capsule_entries_capsule_user" UNIQUE ("capsule_id", "user_id"),
        CONSTRAINT "UQ_capsule_entries_slot" UNIQUE ("slot_id")
      );
    `);

    await queryRunner.query(`
      ALTER TABLE "capsule_participant_slots"
      ADD CONSTRAINT "FK_capsule_slots_capsule" FOREIGN KEY ("capsule_id") REFERENCES "capsules"("id") ON DELETE CASCADE;
    `);
    await queryRunner.query(`
      ALTER TABLE "capsule_participant_slots"
      ADD CONSTRAINT "FK_capsule_slots_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE "capsule_entries"
      ADD CONSTRAINT "FK_capsule_entries_capsule" FOREIGN KEY ("capsule_id") REFERENCES "capsules"("id") ON DELETE CASCADE;
    `);
    await queryRunner.query(`
      ALTER TABLE "capsule_entries"
      ADD CONSTRAINT "FK_capsule_entries_slot" FOREIGN KEY ("slot_id") REFERENCES "capsule_participant_slots"("id") ON DELETE CASCADE;
    `);
    await queryRunner.query(`
      ALTER TABLE "capsule_entries"
      ADD CONSTRAINT "FK_capsule_entries_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "capsule_entries" DROP CONSTRAINT "FK_capsule_entries_user";
    `);
    await queryRunner.query(`
      ALTER TABLE "capsule_entries" DROP CONSTRAINT "FK_capsule_entries_slot";
    `);
    await queryRunner.query(`
      ALTER TABLE "capsule_entries" DROP CONSTRAINT "FK_capsule_entries_capsule";
    `);
    await queryRunner.query(`
      ALTER TABLE "capsule_participant_slots" DROP CONSTRAINT "FK_capsule_slots_user";
    `);
    await queryRunner.query(`
      ALTER TABLE "capsule_participant_slots" DROP CONSTRAINT "FK_capsule_slots_capsule";
    `);

    await queryRunner.query(`DROP TABLE "capsule_entries";`);
    await queryRunner.query(`DROP TABLE "capsule_participant_slots";`);
    await queryRunner.query(
      `DROP TYPE "public"."capsule_entries_media_types_enum";`,
    );
  }
}

