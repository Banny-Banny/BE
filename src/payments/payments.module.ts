import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsController, TossPaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { Order } from '../entities/order.entity';
import { Payment } from '../entities/payment.entity';
import { PaymentCancel } from '../entities/payment-cancel.entity';
import { CapsulesModule } from '../capsules/capsules.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, Payment, PaymentCancel]),
    CapsulesModule,
  ],
  controllers: [PaymentsController, TossPaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}

