import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CapsulesController } from './capsules.controller';
import { CapsulesService } from './capsules.service';
import { Capsule, Product, User, Friendship } from '../entities';

@Module({
  imports: [TypeOrmModule.forFeature([Capsule, User, Product, Friendship])],
  controllers: [CapsulesController],
  providers: [CapsulesService],
})
export class CapsulesModule {}
