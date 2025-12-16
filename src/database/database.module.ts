import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
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
} from '../entities';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 5432),
        username: configService.get<string>('DB_USERNAME', 'postgres'),
        password: configService.get<string>('DB_PASSWORD', ''),
        database: configService.get<string>('DB_DATABASE', 'banny_banny'),
        entities: [
          User,
          Product,
          Capsule,
          CapsuleAccessLog,
          Order,
          Payment,
          Friendship,
          CustomerService,
        ],
        synchronize: configService.get<string>('NODE_ENV') === 'development', // 개발 환경에서만 true
        logging: configService.get<string>('NODE_ENV') === 'development',
        // PostgreSQL 특화 설정
        extra: {
          // Connection Pool 설정
          max: 20,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 2000,
        },
      }),
    }),
  ],
})
export class DatabaseModule {}
