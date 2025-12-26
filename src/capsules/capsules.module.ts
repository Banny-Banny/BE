import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CapsulesController } from './capsules.controller';
import { CapsuleEntriesController } from './capsule-entries.controller';
import { CapsulesService } from './capsules.service';
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
  ],
  controllers: [CapsulesController, CapsuleEntriesController],
  providers: [CapsulesService],
  exports: [CapsulesService],
})
export class CapsulesModule {}
