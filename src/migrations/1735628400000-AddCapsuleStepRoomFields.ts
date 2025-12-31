import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCapsuleStepRoomFields1735628400000
  implements MigrationInterface
{
  name = 'AddCapsuleStepRoomFields1735628400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // RoomStatus enum 생성
    await queryRunner.query(`
      CREATE TYPE "capsules_room_status_enum" AS ENUM('WAITING', 'COMPLETED', 'EXPIRED')
    `);

    // Capsule 테이블에 대기실 필드 추가
    await queryRunner.query(`
      ALTER TABLE "capsules" 
      ADD COLUMN "invite_code" VARCHAR(6) UNIQUE,
      ADD COLUMN "deadline" TIMESTAMP,
      ADD COLUMN "room_status" "capsules_room_status_enum"
    `);

    // 인덱스 생성
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_capsules_invite_code" ON "capsules" ("invite_code") WHERE "invite_code" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_capsules_deadline" ON "capsules" ("deadline") WHERE "deadline" IS NOT NULL
    `);

    // 컬럼 코멘트 추가
    await queryRunner.query(`
      COMMENT ON COLUMN "capsules"."invite_code" IS '대기실 초대 코드 (결제 완료 후 생성)'
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN "capsules"."deadline" IS '대기실 마감시한 (결제 완료 + 24시간)'
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN "capsules"."room_status" IS '대기실 상태 (nullable: 대기실 없음)'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 인덱스 제거
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_capsules_deadline"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_capsules_invite_code"`);

    // 컬럼 제거
    await queryRunner.query(`
      ALTER TABLE "capsules" 
      DROP COLUMN IF EXISTS "room_status",
      DROP COLUMN IF EXISTS "deadline",
      DROP COLUMN IF EXISTS "invite_code"
    `);

    // Enum 제거
    await queryRunner.query(`DROP TYPE IF EXISTS "capsules_room_status_enum"`);
  }
}

