import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './services/payments.service';
import { RazorpayService } from './services/razorpay.service';
import { WebhookService } from './services/webhook.service';
import { PaymentHistoryService } from './services/payment-history.service';
import { CreditsModule } from '../credits/credits.module';
import { User, CreditTransaction } from '../../entities';
import { Payment } from '../../entities/payment.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([User, CreditTransaction, Payment]),
        CreditsModule,
    ],
    controllers: [PaymentsController],
    providers: [
        PaymentsService,
        RazorpayService,
        WebhookService,
        PaymentHistoryService,
    ],
    exports: [PaymentsService, RazorpayService],
})
export class PaymentsModule { }