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
import { CapsuleMediaService } from './capsule-media.service';
import { CapsuleAccessService } from './capsule-access.service';
import { EasterEggService } from './easter-egg.service';
import { TimeCapsuleService } from './time-capsule.service';
import { CapsulesStepRoomService } from './capsules-step-room.service';
import { CapsulesCronService } from './capsules-cron.service';
import {
  Capsule,
  TimeCapsule,
  EasterEgg,
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
      TimeCapsule,
      EasterEgg,
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
    CapsuleAccessService,
    CapsuleMediaService,
    EasterEggService,
    TimeCapsuleService,
    CapsulesStepRoomService,
    CapsulesCronService,
    PushNotificationService,
  ],
  exports: [
    CapsulesService,
    CapsulesStepRoomService,
    EasterEggService,
    TimeCapsuleService,
  ],
})
export class CapsulesModule {}
