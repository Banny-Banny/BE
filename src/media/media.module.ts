import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import {
  Media,
  CapsuleParticipantSlot,
  Capsule,
  CapsuleAccessLog,
} from '../entities';
import { MediaService } from './media.service';
import { MediaController } from './media.controller';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      Media,
      CapsuleParticipantSlot,
      Capsule,
      CapsuleAccessLog,
    ]),
  ],
  providers: [MediaService],
  controllers: [MediaController],
  exports: [MediaService],
})
export class MediaModule {}
