import { Module } from '@nestjs/common';
import { TypeOrmModule, type TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
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

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService): TypeOrmModuleOptions => {
        const databaseUrl = configService.get<string>('DATABASE_URL');
        const isDev = configService.get<string>('NODE_ENV') === 'development';

        const entities = [
          User,
          Product,
          Capsule,
          CapsuleAccessLog,
          Order,
          Payment,
          Friendship,
          CustomerService,
          Media,
        ];

        const extra = {
          max: 20,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 2000,
        };

        const pgHost =
          configService.get<string>('DB_HOST') ||
          configService.get<string>('PG_HOST') ||
          'localhost';
        const pgPort = Number(
          configService.get<string>('DB_PORT') ||
            configService.get<string>('PG_PORT') ||
            '5432',
        );
        const pgUser =
          configService.get<string>('DB_USERNAME') ||
          configService.get<string>('PG_USER') ||
          'postgres';
        const pgPassword =
          configService.get<string>('DB_PASSWORD') ||
          configService.get<string>('PG_PASSWORD') ||
          '';
        const pgDatabase =
          configService.get<string>('DB_DATABASE') ||
          configService.get<string>('PG_DATABASE') ||
          'banny_banny';
        const sslEnabled =
          configService.get<string>('DB_SSL') === 'true' ||
          (configService.get<string>('PGSSLMODE') ?? '').toLowerCase() !==
            'disable';

        const options: TypeOrmModuleOptions = databaseUrl
          ? {
              type: 'postgres',
              url: databaseUrl,
              ssl: { rejectUnauthorized: false },
              uuidExtension: 'pgcrypto',
              entities,
              synchronize: isDev,
              logging: isDev,
              extra,
            }
          : {
              type: 'postgres',
              host: pgHost,
              port: pgPort,
              username: pgUser,
              password: pgPassword,
              database: pgDatabase,
              ssl: sslEnabled ? { rejectUnauthorized: false } : undefined,
              uuidExtension: 'pgcrypto',
              entities,
              synchronize: isDev,
              logging: isDev,
              extra,
            };

        return options;
      },
    }),
  ],
})
export class DatabaseModule {}
