import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CapsulesController } from './capsules.controller';
import { CapsulesService } from './capsules.service';
import { Capsule, Product, User, Friendship, Media, Order } from '../entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Capsule,
      User,
      Product,
      Friendship,
      Media,
      Order,
    ]),
  ],
  controllers: [CapsulesController],
  providers: [CapsulesService],
  exports: [CapsulesService],
})
export class CapsulesModule {}
