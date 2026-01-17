import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 관리자 계정 테이블 생성
 */
export class CreateAdminUsers1768608000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE admin_users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email varchar(100) NOT NULL UNIQUE,
        name varchar(50) NOT NULL,
        password_hash varchar(255) NOT NULL,
        role varchar(20) NOT NULL DEFAULT 'ADMIN',
        token_version int NOT NULL DEFAULT 0,
        refresh_token_hash varchar(255) NULL,
        is_active boolean NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NULL
      )
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN admin_users.role IS 'SUPER_ADMIN | ADMIN'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE admin_users`);
  }
}
