import { MigrationInterface, QueryRunner } from 'typeorm';
import crypto from 'crypto';

/**
 * 슈퍼 어드민 비밀번호 해시 보정
 * - password_hash가 평문이거나 scrypt 포맷이 아닐 경우 보정
 */
export class FixSuperAdminPasswordHash1768792600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const email = 'superadmin@example.com';
    const password = 'superadmin1234!';

    const rows = (await queryRunner.query(
      `SELECT password_hash FROM admin_users WHERE email = $1 LIMIT 1`,
      [email],
    )) as Array<{ password_hash: string | null }>;

    if (!rows.length) {
      return;
    }

    const current = rows[0].password_hash ?? '';
    const looksHashed =
      current.includes(':') && current.split(':').length === 2;
    if (looksHashed) {
      return;
    }

    const passwordHash = this.hashPassword(password);
    await queryRunner.query(
      `UPDATE admin_users SET password_hash = $1 WHERE email = $2`,
      [passwordHash, email],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE admin_users SET password_hash = $1 WHERE email = $2`,
      ['superadmin1234!', 'superadmin@example.com'],
    );
  }

  private hashPassword(password: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const derived = crypto.scryptSync(password, salt, 64) as Buffer;
    return `${salt}:${derived.toString('hex')}`;
  }
}
