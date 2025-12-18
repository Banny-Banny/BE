import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CapsulesController } from './capsules.controller';
import { CapsulesService } from './capsules.service';
import { Capsule, Product, User, Friendship, Media } from '../entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([Capsule, User, Product, Friendship, Media]),
  ],
  controllers: [CapsulesController],
  providers: [CapsulesService],
})
export class CapsulesModule {}
