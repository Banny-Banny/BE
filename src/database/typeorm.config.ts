import 'dotenv/config';
import { DataSource } from 'typeorm';
import {
  User,
  AdminUser,
  Product,
  Capsule,
  TimeCapsule,
  EasterEgg,
  CapsuleAccessLog,
  Order,
  Payment,
  PaymentCancel,
  Friendship,
  CustomerService,
  Media,
  CapsuleParticipantSlot,
  CapsuleEntry,
  Notification,
} from '../entities';

/**
 * TypeORM DataSource for CLI migrations.
 * - DATABASE_URL이 있으면 우선 사용.
 * - 없으면 PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE 사용.
 * - 필수 PG 환경변수가 없으면 바로 에러를 던져 잘못된 기본값 접속을 방지.
 */
const databaseUrl = process.env.DATABASE_PUBLIC_URL;
const usePgEnv = !databaseUrl;

if (usePgEnv) {
  const requiredPgEnv = ['PGHOST', 'PGPORT', 'PGUSER', 'PGDATABASE'];
  const missing = requiredPgEnv.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(
      `Missing required PostgreSQL env vars: ${missing.join(', ')}`,
    );
  }
}

// 프로덕션에서는 빌드된 JS를 사용, 개발에서는 TS를 사용
const isProduction = process.env.NODE_ENV === 'production' || !__filename.endsWith('.ts');
const migrationsGlob = isProduction
  ? 'dist/src/migrations/*.js'
  : 'src/migrations/*.ts';

const dataSource = new DataSource({
  type: 'postgres',
  ...(databaseUrl
    ? {
        url: databaseUrl,
        ssl: { rejectUnauthorized: false },
      }
    : {
        host: process.env.PGHOST as string,
        port: parseInt(process.env.PGPORT as string, 10),
        username: process.env.PGUSER as string,
        password: process.env.PGPASSWORD ?? '',
        database: process.env.PGDATABASE as string,
        ssl:
          process.env.DB_SSL === 'true' ||
          (process.env.PGSSLMODE && process.env.PGSSLMODE !== 'disable')
            ? { rejectUnauthorized: false }
            : undefined,
      }),
  uuidExtension: 'pgcrypto',
  entities: [
    User,
    AdminUser,
    Product,
    Capsule,
    TimeCapsule,
    EasterEgg,
    CapsuleAccessLog,
    CapsuleParticipantSlot,
    CapsuleEntry,
    Order,
    Payment,
    PaymentCancel,
    Friendship,
    CustomerService,
    Media,
    Notification,
  ],
  // ts-node 실행 시 TS, 빌드 산출물 실행 시 JS 마이그레이션을 로드
  migrations: [migrationsGlob],
  synchronize: false,
  logging: true,
});

export default dataSource;
