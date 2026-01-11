import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 온보딩 관련 필드 추가 마이그레이션
 * - users 테이블에 친구 동의, 위치 동의, 온보딩 완료 시점 컬럼 추가
 */
export class AddOnboardingFields1736611200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. 친구 연동 동의 컬럼 추가
    await queryRunner.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS is_friend_consent_agreed BOOLEAN NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN users.is_friend_consent_agreed IS '친구 연동 기능 사용 동의 (온보딩)'
    `);

    // 2. 위치 권한 동의 컬럼 추가
    await queryRunner.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS is_location_consent_agreed BOOLEAN NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN users.is_location_consent_agreed IS '실제 디바이스 위치 권한 허용 여부 (온보딩)'
    `);

    // 3. 온보딩 완료 시점 컬럼 추가
    await queryRunner.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMP NULL
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN users.onboarding_completed_at IS '온보딩 완료 시점'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 컬럼 삭제 (역순)
    await queryRunner.query(`
      ALTER TABLE users
      DROP COLUMN IF EXISTS onboarding_completed_at
    `);

    await queryRunner.query(`
      ALTER TABLE users
      DROP COLUMN IF EXISTS is_location_consent_agreed
    `);

    await queryRunner.query(`
      ALTER TABLE users
      DROP COLUMN IF EXISTS is_friend_consent_agreed
    `);
  }
}
