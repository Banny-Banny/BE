import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLocalAuthFields1700000002000 implements MigrationInterface {
  name = 'AddLocalAuthFields1700000002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 이미 컬럼이 있으면 건너뜀
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'users' AND column_name = 'password_hash'
        ) THEN
          ALTER TABLE "users"
          ADD COLUMN "password_hash" varchar(255);
          COMMENT ON COLUMN "users"."password_hash" IS '로컬 회원가입용 bcrypt 해시';
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'users' AND column_name = 'token_version'
        ) THEN
          ALTER TABLE "users"
          ADD COLUMN "token_version" int DEFAULT 0;
          COMMENT ON COLUMN "users"."token_version" IS '로그아웃/토큰 무효화를 위한 버전';
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'users' AND column_name = 'token_version'
        ) THEN
          ALTER TABLE "users" DROP COLUMN "token_version";
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'users' AND column_name = 'password_hash'
        ) THEN
          ALTER TABLE "users" DROP COLUMN "password_hash";
        END IF;
      END
      $$;
    `);
  }
}
