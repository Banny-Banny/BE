import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import {
  CapsulesController,
  TimecapsulesController,
} from './capsules.controller';
import { CapsuleEntriesController } from './capsule-entries.controller';
import { CapsulesStepRoomController } from './capsules-step-room.controller';
import { CapsulesService } from './capsules.service';
import { CapsulesStepRoomService } from './capsules-step-room.service';
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
  Notification,
} from '../entities';
import { MediaModule } from '../media/media.module';
import { PushNotificationService } from '../common/services/push-notification.service';

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
      Notification,
    ]),
    ScheduleModule.forRoot(),
    MediaModule,
  ],
  controllers: [
    CapsulesController,
    CapsuleEntriesController,
    CapsulesStepRoomController,
    TimecapsulesController,
  ],
  providers: [
    CapsulesService,
    CapsulesStepRoomService,
    CapsulesCronService,
    PushNotificationService,
  ],
  exports: [CapsulesService, CapsulesStepRoomService],
})
export class CapsulesModule {}
