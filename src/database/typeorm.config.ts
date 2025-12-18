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
 * - Uses SUPABASE_DIRECT_URL (5432) when provided, otherwise DATABASE_URL.
 * - uuidExtension=pgcrypto to align with Supabase free tier.
 */
const dataSource = new DataSource({
  type: 'postgres',
  url: process.env.SUPABASE_DIRECT_URL || process.env.DATABASE_URL,
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
