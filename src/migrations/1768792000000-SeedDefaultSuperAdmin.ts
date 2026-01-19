import { MigrationInterface, QueryRunner } from 'typeorm';
import crypto from 'crypto';

/**
 * 기본 슈퍼 어드민 계정 시드
 */
export class SeedDefaultSuperAdmin1768792000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const email = 'superadmin@example.com';
    const name = '관리자';
    const password = 'superadmin1234!';

    const existing = (await queryRunner.query(
      `SELECT id FROM admin_users WHERE email = $1 LIMIT 1`,
      [email],
    )) as Array<{ id: string }>;
    if (existing.length > 0) {
      return;
    }

    const passwordHash = this.hashPassword(password);
    await queryRunner.query(
      `
      INSERT INTO admin_users (
        id, email, name, password_hash, role, token_version,
        refresh_token_hash, is_active, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, 'SUPER_ADMIN', 0,
        NULL, true, now(), NULL
      )
      `,
      [email, name, passwordHash],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM admin_users WHERE email = $1`, [
      'superadmin@example.com',
    ]);
  }

  private hashPassword(password: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const derived = crypto.scryptSync(password, salt, 64) as Buffer;
    return `${salt}:${derived.toString('hex')}`;
  }
}
