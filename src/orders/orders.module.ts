import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { Order } from '../entities/order.entity';
import { Product } from '../entities/product.entity';
import { Payment } from '../entities/payment.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Order, Product, Payment])],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}

