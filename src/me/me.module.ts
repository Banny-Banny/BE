import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  User,
  Friendship,
  Notification,
  Capsule,
  CapsuleParticipantSlot,
  CapsuleEntry,
  CustomerService,
  CustomerServiceMessage,
} from '../entities';
import { AuthModule } from '../auth/auth.module';
import { MediaModule } from '../media/media.module';
import { MeController } from './me.controller';
import { MeService } from './me.service';
import { FriendsController } from './friends.controller';
import { FriendsService } from './friends.service';
import {
  NotificationsController,
  AdminNotificationsController,
} from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { PushNotificationService } from '../common/services/push-notification.service';
import { InquiriesController } from './inquiries.controller';
import { InquiriesService } from './inquiries.service';

/**
 * 마이페이지 모듈
 * 프로필 관리, 친구 관리, 타임캡슐 참여 내역, 알림 관리 기능 제공
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Friendship,
      Notification,
      Capsule,
      CapsuleParticipantSlot,
      CapsuleEntry,
      CustomerService,
      CustomerServiceMessage,
    ]),
    AuthModule,
    MediaModule,
  ],
  controllers: [
    MeController,
    FriendsController,
    NotificationsController,
    AdminNotificationsController,
    InquiriesController,
  ],
  providers: [
    MeService,
    FriendsService,
    NotificationsService,
    PushNotificationService,
    InquiriesService,
  ],
  exports: [
    MeService,
    FriendsService,
    NotificationsService,
    PushNotificationService,
  ],
})
export class MeModule {}
