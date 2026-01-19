import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddKakaoFriendsSyncFields1767872430329 implements MigrationInterface {
  name = 'AddKakaoFriendsSyncFields1767872430329';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "notifications" DROP CONSTRAINT "fk_notifications_user_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_notifications_user_id_created_at"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_notifications_user_id_is_read"`,
    );
    await queryRunner.query(`COMMENT ON TABLE "notifications" IS NULL`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD "kakao_access_token" text`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "users"."kakao_access_token" IS '카카오 액세스 토큰 (친구 목록 조회 등에 사용)'`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "kakao_refresh_token" text`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "users"."kakao_refresh_token" IS '카카오 리프레시 토큰'`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "last_kakao_friends_sync_at" TIMESTAMP`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "users"."last_kakao_friends_sync_at" IS '마지막 카카오 친구 동기화 시간'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."notification_type_enum" RENAME TO "notification_type_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."notifications_type_enum" AS ENUM('CAPSULE_OPEN', 'FRIEND_REQUEST', 'FRIEND_ACCEPTED', 'SYSTEM', 'MARKETING')`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ALTER COLUMN "type" TYPE "public"."notifications_type_enum" USING "type"::"text"::"public"."notifications_type_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."notification_type_enum_old"`);
    await queryRunner.query(
      `ALTER TABLE "notifications" ALTER COLUMN "created_at" SET DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ADD CONSTRAINT "FK_9a8a82462cab47c73d25f49261f" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "notifications" DROP CONSTRAINT "FK_9a8a82462cab47c73d25f49261f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."notification_type_enum_old" AS ENUM('CAPSULE_OPEN', 'FRIEND_REQUEST', 'FRIEND_ACCEPTED', 'SYSTEM', 'MARKETING')`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ALTER COLUMN "type" TYPE "public"."notification_type_enum_old" USING "type"::"text"::"public"."notification_type_enum_old"`,
    );
    await queryRunner.query(`DROP TYPE "public"."notifications_type_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."notification_type_enum_old" RENAME TO "notification_type_enum"`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "users"."last_kakao_friends_sync_at" IS '마지막 카카오 친구 동기화 시간'`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "last_kakao_friends_sync_at"`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "users"."kakao_refresh_token" IS '카카오 리프레시 토큰'`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "kakao_refresh_token"`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "users"."kakao_access_token" IS '카카오 액세스 토큰 (친구 목록 조회 등에 사용)'`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "kakao_access_token"`,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "notifications" IS '사용자 알림 관리 테이블'`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_notifications_user_id_is_read" ON "notifications" ("is_read", "user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_notifications_user_id_created_at" ON "notifications" ("created_at", "user_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ADD CONSTRAINT "fk_notifications_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }
}
