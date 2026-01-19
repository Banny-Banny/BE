import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateCapsuleMediaLimit1768035259847 implements MigrationInterface {
  name = 'UpdateCapsuleMediaLimit1768035259847';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "capsules" DROP CONSTRAINT "CHK_f7e1c3066476cc63c23c4d6d75"`,
    );
    await queryRunner.query(
      `ALTER TABLE "capsules" ADD CONSTRAINT "CHK_b974f9ef29939c276a94a09c1e" CHECK ((media_urls IS NULL OR array_length(media_urls, 1) <= 10) AND (media_types IS NULL OR array_length(media_types, 1) <= 10))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "capsules" DROP CONSTRAINT "CHK_b974f9ef29939c276a94a09c1e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "capsules" ADD CONSTRAINT "CHK_f7e1c3066476cc63c23c4d6d75" CHECK ((((media_urls IS NULL) OR (array_length(media_urls, 1) <= 3)) AND ((media_types IS NULL) OR (array_length(media_types, 1) <= 3))))`,
    );
  }
}
