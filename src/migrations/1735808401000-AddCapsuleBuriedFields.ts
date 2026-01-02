import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCapsuleBuriedFields1735808401000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // BURIED 상태 추가
    await queryRunner.query(`
      ALTER TYPE "capsules_room_status_enum" ADD VALUE IF NOT EXISTS 'BURIED'
    `);

    // buriedAt 컬럼 추가
    await queryRunner.query(`
      ALTER TABLE "capsules"
      ADD COLUMN IF NOT EXISTS "buried_at" TIMESTAMP NULL
    `);

    // isAutoSubmitted 컬럼 추가
    await queryRunner.query(`
      ALTER TABLE "capsules"
      ADD COLUMN IF NOT EXISTS "is_auto_submitted" BOOLEAN DEFAULT false
    `);

    // 컬럼 주석 추가
    await queryRunner.query(`
      COMMENT ON COLUMN "capsules"."buried_at" IS '캡슐이 매장된 시각'
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN "capsules"."is_auto_submitted" IS '자동 제출 여부'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "capsules"
      DROP COLUMN IF EXISTS "is_auto_submitted",
      DROP COLUMN IF EXISTS "buried_at"
    `);

    // BURIED enum 값 제거는 PostgreSQL에서 직접 지원하지 않음
    // 필요 시 enum 재생성 또는 수동 처리 필요
  }
}

