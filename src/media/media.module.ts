import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Media } from '../entities';
import { MediaService } from './media.service';
import { MediaController } from './media.controller';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([Media])],
  providers: [MediaService],
  controllers: [MediaController],
})
export class MediaModule {}

