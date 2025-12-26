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
  PaymentCancel,
  Friendship,
  CustomerService,
  Media,
  CapsuleParticipantSlot,
  CapsuleEntry,
} from '../entities';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService): TypeOrmModuleOptions => {
        const isTestDb =
          configService.get<string>('NODE_ENV') === 'test' ||
          configService.get<string>('PLAYWRIGHT') === 'true' ||
          !!configService.get<string>('TEST_DB_HOST');

        const databaseUrl =
          configService.get<string>('DATABASE_PUBLIC_URL') ??
          (!isTestDb ? configService.get<string>('DATABASE_URL') : undefined);
        const isDev = configService.get<string>('NODE_ENV') === 'development';

        const entities = [
          User,
          Product,
          Capsule,
          CapsuleAccessLog,
          CapsuleParticipantSlot,
          CapsuleEntry,
          Order,
          Payment,
          PaymentCancel,
          Friendship,
          CustomerService,
          Media,
        ];

        const extra = {
          max: 20,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 2000,
        };

        const pgHost = isTestDb
          ? (configService.get<string>('TEST_DB_HOST') ?? 'localhost')
          : configService.get<string>('PGHOST');
        const pgPort = Number(
          isTestDb
            ? (configService.get<string>('TEST_DB_PORT') ?? '5432')
            : configService.get<string>('PGPORT'),
        );
        const pgUser = isTestDb
          ? (configService.get<string>('TEST_DB_USERNAME') ?? 'postgres')
          : configService.get<string>('PGUSER');
        const pgPassword = isTestDb
          ? (configService.get<string>('TEST_DB_PASSWORD') ?? '')
          : configService.get<string>('PGPASSWORD');
        const pgDatabase = isTestDb
          ? (configService.get<string>('TEST_DB_DATABASE') ?? 'banny_banny')
          : configService.get<string>('PGDATABASE');
        const sslEnabled =
          !isTestDb &&
          (configService.get<string>('DB_SSL') === 'true' ||
            (configService.get<string>('PGSSLMODE') ?? '').toLowerCase() !==
              'disable');

        if (!databaseUrl) {
          const requiredPg = isTestDb
            ? [
                ['TEST_DB_HOST', configService.get<string>('TEST_DB_HOST')],
                ['TEST_DB_PORT', configService.get<string>('TEST_DB_PORT')],
                [
                  'TEST_DB_USERNAME',
                  configService.get<string>('TEST_DB_USERNAME'),
                ],
                [
                  'TEST_DB_DATABASE',
                  configService.get<string>('TEST_DB_DATABASE'),
                ],
              ]
            : [
                ['PGHOST', configService.get<string>('PGHOST')],
                ['PGPORT', configService.get<string>('PGPORT')],
                ['PGUSER', configService.get<string>('PGUSER')],
                ['PGDATABASE', configService.get<string>('PGDATABASE')],
              ];
          const missing = requiredPg.filter(([, value]) => !value);
          if (missing.length) {
            throw new Error(
              `Missing required PostgreSQL env vars: ${missing
                .map(([key]) => key)
                .join(', ')}`,
            );
          }
        }

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
              host: pgHost as string,
              port: pgPort,
              username: pgUser as string,
              password: pgPassword ?? '',
              database: pgDatabase as string,
              ssl: sslEnabled ? { rejectUnauthorized: false } : undefined,
              uuidExtension: 'pgcrypto',
              entities,
              synchronize: isDev,
              logging: isDev,
              extra,
            };

        if (isTestDb) {
          console.log(
            `[db] test db -> host=${pgHost}:${pgPort} db=${pgDatabase} user=${pgUser}`,
          );
        }

        return options;
      },
    }),
  ],
})
export class DatabaseModule {}
