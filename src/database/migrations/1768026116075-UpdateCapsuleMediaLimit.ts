import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateCapsuleMediaLimit1768026116075 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 기존 CHECK 제약 조건 삭제
    await queryRunner.query(
      `ALTER TABLE "capsules" DROP CONSTRAINT IF EXISTS "CHK_f7e1c3066476cc63c23c4d6d75"`,
    );

    // 새로운 CHECK 제약 조건 추가 (최대 30개)
    // 타임캡슐은 여러 참여자의 미디어를 모두 저장해야 하므로 제약을 완화
    await queryRunner.query(
      `ALTER TABLE "capsules" ADD CONSTRAINT "CHK_media_limit" 
       CHECK ((media_urls IS NULL OR array_length(media_urls, 1) <= 30) 
          AND (media_types IS NULL OR array_length(media_types, 1) <= 30))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 새로운 제약 조건 삭제
    await queryRunner.query(
      `ALTER TABLE "capsules" DROP CONSTRAINT IF EXISTS "CHK_media_limit"`,
    );

    // 기존 제약 조건 복원
    await queryRunner.query(
      `ALTER TABLE "capsules" ADD CONSTRAINT "CHK_f7e1c3066476cc63c23c4d6d75" 
       CHECK ((media_urls IS NULL OR array_length(media_urls, 1) <= 3) 
          AND (media_types IS NULL OR array_length(media_types, 1) <= 3))`,
    );
  }
}
