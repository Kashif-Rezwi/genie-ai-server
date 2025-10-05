import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Payment, PaymentStatus } from '../../../entities';
import { RazorpayService } from './razorpay.service';
import { CreditsService } from '../../credits/services/credits.service';
import { RazorpayWebhookEvent } from '../interfaces/webhook.interface';
import { IPaymentRepository } from '../../../core/repositories/interfaces';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly paymentRepository: IPaymentRepository,
    private readonly razorpayService: RazorpayService,
    private readonly creditsService: CreditsService,
    private readonly dataSource: DataSource
  ) {}

  async handleRazorpayWebhook(
    body: string,
    signature: string
  ): Promise<{ success: boolean; message: string }> {
    const maxRetries = 3;
    let retryCount = 0;

    while (retryCount < maxRetries) {
      try {
        // Verify webhook signature
        const isValid = this.razorpayService.verifyWebhookSignature(body, signature);

        if (!isValid) {
          this.logger.warn('Invalid webhook signature received');
          throw new BadRequestException('Invalid webhook signature');
        }

        const event: RazorpayWebhookEvent = JSON.parse(body);
        this.logger.log(`Processing webhook event: ${event.event} (attempt ${retryCount + 1})`);

        switch (event.event) {
          case 'payment.captured':
            return await this.handlePaymentCaptured(event);

          case 'payment.failed':
            return await this.handlePaymentFailed(event);

          case 'order.paid':
            return await this.handleOrderPaid(event);

          default:
            this.logger.log(`Unhandled webhook event: ${event.event}`);
            return { success: true, message: 'Event acknowledged but not processed' };
        }
      } catch (error) {
        retryCount++;
        this.logger.error(`Webhook processing failed (attempt ${retryCount}):`, error);

        if (retryCount >= maxRetries) {
          this.logger.error('Webhook processing failed after all retries');
          throw error;
        }

        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
      }
    }

    throw new Error('Webhook processing failed after all retries');
  }

  private async handlePaymentCaptured(
    event: RazorpayWebhookEvent
  ): Promise<{ success: boolean; message: string }> {
    const paymentEntity = event.payload.payment.entity;

    return this.dataSource.transaction(async manager => {
      // Find payment record
      const payment = await manager.findOne(Payment, {
        where: { razorpayOrderId: paymentEntity.order_id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!payment) {
        this.logger.warn(`Payment not found for order: ${paymentEntity.order_id}`);
        return { success: true, message: 'Payment record not found' };
      }

      if (payment.status === PaymentStatus.COMPLETED) {
        this.logger.log(`Payment already completed: ${payment.id}`);
        return { success: true, message: 'Payment already processed' };
      }

      // Update payment record
      payment.razorpayPaymentId = paymentEntity.id;
      payment.status = PaymentStatus.COMPLETED;
      payment.metadata = {
        ...payment.metadata,
        webhookPayment: {
          method: paymentEntity.method,
          bank: paymentEntity.bank,
          wallet: paymentEntity.wallet,
          vpa: paymentEntity.vpa,
          card_id: paymentEntity.card_id,
          fee: this.razorpayService.paiseToRupees(paymentEntity.fee),
          tax: this.razorpayService.paiseToRupees(paymentEntity.tax),
        },
      };

      await manager.save(payment);

      // Add credits if not already added
      if (!payment.creditTransactionId) {
        await this.creditsService.addCredits(
          payment.userId,
          payment.creditsAmount,
          `Package purchase: ${payment.packageName} (Webhook)`,
          { paymentId: paymentEntity.id }
        );

        payment.status = PaymentStatus.COMPLETED;
        await manager.save(payment);

        this.logger.log(
          `Credits added for payment: ${payment.id}, amount: ${payment.creditsAmount}`
        );
      }

      return { success: true, message: 'Payment captured and credits added successfully' };
    });
  }

  private async handlePaymentFailed(
    event: RazorpayWebhookEvent
  ): Promise<{ success: boolean; message: string }> {
    const paymentEntity = event.payload.payment.entity;

    const payment = await this.paymentRepository.findOne({
      where: { razorpayOrderId: paymentEntity.order_id },
    });

    if (!payment) {
      this.logger.warn(`Payment not found for failed order: ${paymentEntity.order_id}`);
      return { success: true, message: 'Payment record not found' };
    }

    // Update payment as failed
    payment.razorpayPaymentId = paymentEntity.id;
    payment.status = PaymentStatus.FAILED;
    payment.failureReason = paymentEntity.error_description || 'Payment failed';
    payment.metadata = {
      ...payment.metadata,
      failureDetails: {
        error_code: paymentEntity.error_code,
        error_description: paymentEntity.error_description,
        error_source: paymentEntity.error_source,
        error_step: paymentEntity.error_step,
        error_reason: paymentEntity.error_reason,
      },
    };

    await this.paymentRepository.save(payment);

    this.logger.log(`Payment marked as failed: ${payment.id}, reason: ${payment.failureReason}`);
    return { success: true, message: 'Payment failure recorded' };
  }

  private async handleOrderPaid(
    event: RazorpayWebhookEvent
  ): Promise<{ success: boolean; message: string }> {
    // This event is fired when an order is completely paid
    // We can use this for additional validation or business logic

    const orderEntity = event.payload.order?.entity;
    if (!orderEntity) {
      return { success: true, message: 'No order entity in webhook' };
    }

    const payment = await this.paymentRepository.findOne({
      where: { razorpayOrderId: orderEntity.id },
    });

    if (payment && payment.status === PaymentStatus.COMPLETED) {
      this.logger.log(`Order paid confirmation for: ${payment.id}`);

      // Update metadata with order paid confirmation
      payment.metadata = {
        ...payment.metadata,
        orderPaidConfirmation: {
          amount_paid: this.razorpayService.paiseToRupees(orderEntity.amount_paid),
          confirmed_at: new Date().toISOString(),
        },
      };

      await this.paymentRepository.save(payment);
    }

    return { success: true, message: 'Order paid confirmation processed' };
  }

  async retryFailedPaymentProcessing(paymentId: string): Promise<void> {
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new BadRequestException('Payment not found');
    }

    if (payment.status !== PaymentStatus.FAILED || !payment.razorpayPaymentId) {
      throw new BadRequestException('Payment is not in a retryable state');
    }

    // Fetch latest payment status from Razorpay
    const razorpayPayment = await this.razorpayService.fetchPayment(payment.razorpayPaymentId);

    if (razorpayPayment.status === 'captured') {
      // Payment was actually successful, update our records
      await this.dataSource.transaction(async manager => {
        payment.status = PaymentStatus.COMPLETED;
        payment.failureReason = '';
        await manager.save(payment);

        // Add credits if not already added
        if (!payment.creditTransactionId) {
          await this.creditsService.addCredits(
            payment.userId,
            payment.creditsAmount,
            `Package purchase: ${payment.packageName} (Retry)`,
            { paymentId: payment.razorpayPaymentId }
          );

          payment.status = PaymentStatus.COMPLETED;
          await manager.save(payment);
        }
      });

      this.logger.log(`Payment retry successful: ${payment.id}`);
    } else {
      this.logger.log(
        `Payment still failed after retry: ${payment.id}, status: ${razorpayPayment.status}`
      );
    }
  }
}
