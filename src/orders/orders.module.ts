import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { Order } from '../entities/order.entity';
import { Product } from '../entities/product.entity';
import { Payment } from '../entities/payment.entity';
import { CapsulesModule } from '../capsules/capsules.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, Product, Payment]),
    forwardRef(() => CapsulesModule),
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
