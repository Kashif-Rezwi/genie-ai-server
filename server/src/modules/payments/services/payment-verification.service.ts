import {
  Injectable,
  Logger,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Payment, PaymentStatus, PaymentMethod, User } from '../../../entities';
import { RazorpayService } from './razorpay.service';
import { CreditsService } from '../../credits/services/credits.service';
import { IPaymentRepository, IUserRepository } from '../../../core/repositories/interfaces';
import { ResourceNotFoundException, PaymentException, ValidationException, ConflictException } from '../../../common/exceptions';
import {
  VerifyPaymentDto,
  PaymentVerificationResponse,
} from '../dto/payment.dto';

@Injectable()
export class PaymentVerificationService {
  private readonly logger = new Logger(PaymentVerificationService.name);

  constructor(
    private readonly paymentRepository: IPaymentRepository,
    private readonly userRepository: IUserRepository,
    private readonly razorpayService: RazorpayService,
    private readonly creditsService: CreditsService,
    private readonly dataSource: DataSource
  ) {}

  /**
   * Verify and complete payment
   */
  async verifyAndCompletePayment(
    verifyDto: VerifyPaymentDto
  ): Promise<PaymentVerificationResponse> {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = verifyDto;

    // Get payment record
    const payment = await this.paymentRepository.findByRazorpayOrderId(razorpayOrderId);

    if (!payment) {
      throw new ResourceNotFoundException('Payment', 'PAYMENT_NOT_FOUND', { razorpayOrderId });
    }

    if (payment.status === PaymentStatus.COMPLETED) {
      throw new ConflictException('Payment already completed', 'PAYMENT_ALREADY_COMPLETED', { 
        paymentId: payment.id,
        currentStatus: payment.status
      });
    }

    // Verify Razorpay signature
    const isValid = await this.razorpayService.verifyWebhookSignature(
      razorpayOrderId,
      razorpaySignature
    );

    if (!isValid) {
      payment.status = PaymentStatus.FAILED;
      payment.failureReason = 'Invalid signature';
      await this.paymentRepository.update(payment.id, payment);
      throw new ValidationException('Invalid payment signature', 'INVALID_PAYMENT_SIGNATURE', { 
        razorpayOrderId,
        razorpayPaymentId
      });
    }

    // Get Razorpay payment details
    const razorpayPayment = await this.razorpayService.fetchPayment(razorpayPaymentId);

    if (razorpayPayment.status !== 'captured') {
      payment.status = PaymentStatus.FAILED;
      payment.failureReason = 'Payment not captured';
      await this.paymentRepository.update(payment.id, payment);
      throw new PaymentException('Payment not captured', 'PAYMENT_NOT_CAPTURED', { 
        razorpayPaymentId,
        razorpayStatus: razorpayPayment.status
      });
    }

    // Update payment record
    payment.razorpayPaymentId = razorpayPaymentId;
    payment.status = PaymentStatus.COMPLETED;
    payment.metadata = {
      ...payment.metadata,
      razorpayPayment,
    };

    // Use transaction to ensure data consistency
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Save payment
      await this.paymentRepository.update(payment.id, payment);

      // Add credits to user account
      await this.creditsService.addCredits(
        payment.userId,
        payment.creditsAmount,
        'payment_completion',
        { description: `Payment completed for ${payment.packageName}` }
      );

      // Update payment with credit transaction ID (we'll need to get this from the transaction service)
      // For now, we'll set a placeholder
      payment.creditTransactionId = `credit_${Date.now()}`;
      await this.paymentRepository.update(payment.id, payment);

      await queryRunner.commitTransaction();

      this.logger.log(`Payment ${payment.id} completed successfully for user ${payment.userId}`);

      return {
        success: true,
        payment: {
          id: payment.id,
          orderId: payment.razorpayOrderId,
          paymentId: razorpayPaymentId,
          status: payment.status,
          amount: payment.amount,
          creditsAdded: payment.creditsAmount,
          newBalance: 0, // This would need to be calculated from user's current balance
        },
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error completing payment ${payment.id}:`, error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Retry failed payment processing
   */
  async retryFailedPaymentProcessing(
    paymentId: string
  ): Promise<PaymentVerificationResponse> {
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new ResourceNotFoundException('Payment', 'PAYMENT_NOT_FOUND', { paymentId });
    }

    if (payment.status !== PaymentStatus.FAILED || !payment.razorpayPaymentId) {
      throw new PaymentException('Payment is not in a retryable state', 'PAYMENT_NOT_RETRYABLE', { 
        currentStatus: payment.status,
        hasRazorpayPaymentId: !!payment.razorpayPaymentId
      });
    }

    // Check Razorpay payment status
    const razorpayPayment = await this.razorpayService.fetchPayment(payment.razorpayPaymentId);

    if (razorpayPayment.status === 'captured') {
      // Payment was actually successful, update our record
      payment.status = PaymentStatus.COMPLETED;

      // Add credits if not already added
      if (!payment.creditTransactionId) {
        await this.creditsService.addCredits(
          payment.userId,
          payment.creditsAmount,
          'payment_retry_completion',
          { description: `Payment retry completed for ${payment.packageName}` }
        );
        payment.creditTransactionId = `credit_${Date.now()}`;
      }

      await this.paymentRepository.save(payment);

      this.logger.log(`Payment ${payment.id} retry completed successfully`);

      return {
        success: true,
        payment: {
          id: payment.id,
          orderId: payment.razorpayOrderId,
          paymentId: payment.razorpayPaymentId,
          status: payment.status,
          amount: payment.amount,
          creditsAdded: payment.creditsAmount,
          newBalance: 0, // This would need to be calculated from user's current balance
        },
      };
    }

    throw new PaymentException('Payment is still in failed state', 'PAYMENT_STILL_FAILED', { 
      paymentId,
      razorpayStatus: razorpayPayment.status
    });
  }

  /**
   * Reconcile payments with Razorpay
   */
  async reconcilePayments(): Promise<{
    reconciled: number;
    failed: number;
    errors: string[];
  }> {
    const payments = await this.paymentRepository.find({
      where: { status: PaymentStatus.PENDING },
    });

    let reconciled = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const payment of payments) {
      if (payment.razorpayOrderId) {
        try {
          const razorpayOrder = await this.razorpayService.fetchOrder(payment.razorpayOrderId);
          
          if (razorpayOrder.status === 'paid') {
            // Payment was successful, update our record
            payment.status = PaymentStatus.COMPLETED;
            await this.paymentRepository.save(payment);
            reconciled++;
          } else if (razorpayOrder.status === 'failed') {
            payment.status = PaymentStatus.FAILED;
            payment.failureReason = 'Payment failed on Razorpay';
            await this.paymentRepository.save(payment);
            failed++;
          }
        } catch (error) {
          errors.push(`Error reconciling payment ${payment.id}: ${error.message}`);
        }
      }
    }

    this.logger.log(`Payment reconciliation completed: ${reconciled} reconciled, ${failed} failed`);

    return { reconciled, failed, errors };
  }
}
