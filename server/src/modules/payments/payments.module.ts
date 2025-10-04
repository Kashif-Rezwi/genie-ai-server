import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './services/payments.service';
import { RazorpayService } from './services/razorpay.service';
import { WebhookService } from './services/webhook.service';
import { CreditsModule } from '../credits/credits.module';
import { SecurityModule } from '../security/security.module';
import { User, CreditTransaction } from '../../entities';
import { Payment } from '../../entities/payment.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, CreditTransaction, Payment]),
    CreditsModule,
    SecurityModule,
    // Removed BullModule - payment processing is synchronous for 0-1000 users
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, RazorpayService, WebhookService],
  exports: [PaymentsService, RazorpayService, WebhookService],
})
export class PaymentsModule {}
