import { MigrationInterface, QueryRunner } from 'typeorm';
import crypto from 'crypto';

/**
 * admin_users 전체 password_hash 보정 (scrypt 포맷이 아닌 평문만 해시 처리)
 */
export class FixAdminPasswordHashAll1768793200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const rows = (await queryRunner.query(
      `SELECT id, password_hash FROM admin_users`,
    )) as Array<{ id: string; password_hash: string | null }>;

    for (const row of rows) {
      const value = row.password_hash ?? '';
      if (!value) {
        continue;
      }
      if (this.looksLikeScryptHash(value)) {
        continue;
      }
      if (value.startsWith('$2')) {
        continue;
      }
      const passwordHash = this.hashPassword(value);
      await queryRunner.query(
        `UPDATE admin_users SET password_hash = $1 WHERE id = $2`,
        [passwordHash, row.id],
      );
    }
  }

  public async down(): Promise<void> {
    // 복구 불가
  }

  private looksLikeScryptHash(value: string) {
    return /^[0-9a-f]{32}:[0-9a-f]{128}$/i.test(value);
  }

  private hashPassword(password: string) {
    const salt = crypto.randomBytes(16).toString('hex');
    const derived = crypto.scryptSync(password, salt, 64) as Buffer;
    return `${salt}:${derived.toString('hex')}`;
  }
}
