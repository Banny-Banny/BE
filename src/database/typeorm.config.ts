import 'dotenv/config';
import { DataSource } from 'typeorm';
import {
  User,
  Product,
  Capsule,
  CapsuleAccessLog,
  Order,
  Payment,
  Friendship,
  CustomerService,
  Media,
} from '../entities';

/**
 * TypeORM DataSource for CLI migrations.
 * - Uses DATABASE_URL when provided (recommended for Railway), otherwise falls back to discrete env vars.
 * - uuidExtension=pgcrypto for gen_random_uuid().
 */
const databaseUrl = process.env.DATABASE_URL;

const dataSource = new DataSource({
  type: 'postgres',
  ...(databaseUrl
    ? {
        url: databaseUrl,
        ssl: { rejectUnauthorized: false },
      }
    : {
        host: process.env.DB_HOST || process.env.PG_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || process.env.PG_PORT || '5432', 10),
        username: process.env.DB_USERNAME || process.env.PG_USER || 'postgres',
        password: process.env.DB_PASSWORD || process.env.PG_PASSWORD || '',
        database: process.env.DB_DATABASE || process.env.PG_DATABASE || 'banny_banny',
        ssl:
          process.env.DB_SSL === 'true' ||
          (process.env.PGSSLMODE && process.env.PGSSLMODE !== 'disable')
            ? { rejectUnauthorized: false }
            : undefined,
      }),
  uuidExtension: 'pgcrypto',
  entities: [
    User,
    Product,
    Capsule,
    CapsuleAccessLog,
    Order,
    Payment,
    Friendship,
    CustomerService,
    Media,
  ],
  migrations: ['dist/migrations/*.js'],
  synchronize: false,
  logging: true,
});

export default dataSource;
