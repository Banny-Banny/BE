import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import crypto from 'crypto';
import { AdminRole } from '../common/enums';

/**
 * 관리자 계정
 */
@Entity('admin_users')
export class AdminUser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 50 })
  name: string;

  @Column({ type: 'varchar', length: 255, name: 'password_hash' })
  passwordHash: string;

  @Column({
    type: 'enum',
    enum: AdminRole,
    default: AdminRole.ADMIN,
  })
  role: AdminRole;

  @Column({
    type: 'int',
    default: 0,
    name: 'token_version',
  })
  tokenVersion: number;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    name: 'refresh_token_hash',
  })
  refreshTokenHash: string | null;

  @Column({
    type: 'boolean',
    default: true,
    name: 'is_active',
  })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', nullable: true })
  updatedAt: Date | null;

  @BeforeInsert()
  @BeforeUpdate()
  private ensurePasswordHash() {
    if (!this.passwordHash) {
      return;
    }
    if (AdminUser.looksLikeScryptHash(this.passwordHash)) {
      return;
    }
    this.passwordHash = AdminUser.hashPassword(this.passwordHash);
  }

  private static looksLikeScryptHash(value: string) {
    return /^[0-9a-f]{32}:[0-9a-f]{128}$/i.test(value);
  }

  private static hashPassword(password: string) {
    const salt = crypto.randomBytes(16).toString('hex');
    const derived = crypto.scryptSync(password, salt, 64) as Buffer;
    return `${salt}:${derived.toString('hex')}`;
  }
}
