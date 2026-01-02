import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { CapsulesController } from './capsules.controller';
import { CapsuleEntriesController } from './capsule-entries.controller';
import { CapsulesService } from './capsules.service';
import { CapsulesCronService } from './capsules-cron.service';
import {
  Capsule,
  Product,
  User,
  Friendship,
  Media,
  Order,
  CapsuleParticipantSlot,
  CapsuleEntry,
  CapsuleAccessLog,
} from '../entities';
import { MediaModule } from '../media/media.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Capsule,
      User,
      Product,
      Friendship,
      Media,
      Order,
      CapsuleParticipantSlot,
      CapsuleEntry,
      CapsuleAccessLog,
    ]),
    ScheduleModule.forRoot(),
    MediaModule,
  ],
  controllers: [CapsulesController, CapsuleEntriesController],
  providers: [CapsulesService, CapsulesCronService],
  exports: [CapsulesService],
})
export class CapsulesModule {}
