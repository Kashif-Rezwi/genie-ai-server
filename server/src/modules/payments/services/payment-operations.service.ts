import {
  Injectable,
  Logger,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Payment, PaymentStatus, PaymentMethod } from '../../../entities';
import { RazorpayService } from './razorpay.service';
import { CreditsService } from '../../credits/services/credits.service';
import { IPaymentRepository } from '../../../core/repositories/interfaces';
import { ResourceNotFoundException, PaymentException, ValidationException } from '../../../common/exceptions';

@Injectable()
export class PaymentOperationsService {
  private readonly logger = new Logger(PaymentOperationsService.name);

  constructor(
    private readonly paymentRepository: IPaymentRepository,
    private readonly razorpayService: RazorpayService,
    private readonly creditsService: CreditsService,
    private readonly dataSource: DataSource
  ) {}

  /**
   * Refund a payment
   */
  async refundPayment(
    paymentId: string,
    refundAmount?: number,
    reason?: string
  ): Promise<{
    success: boolean;
    refundId?: string;
    message: string;
  }> {
    const payment = await this.paymentRepository.findById(paymentId);

    if (!payment) {
      throw new ResourceNotFoundException('Payment', 'PAYMENT_NOT_FOUND', { paymentId });
    }

    if (payment.status !== PaymentStatus.COMPLETED) {
      throw new PaymentException('Only completed payments can be refunded', 'INVALID_PAYMENT_STATUS', { 
        currentStatus: payment.status,
        requiredStatus: PaymentStatus.COMPLETED
      });
    }

    if (payment.method !== PaymentMethod.RAZORPAY) {
      throw new PaymentException('Only Razorpay payments can be refunded', 'INVALID_PAYMENT_METHOD', { 
        currentMethod: payment.method,
        requiredMethod: PaymentMethod.RAZORPAY
      });
    }

    if (!payment.razorpayPaymentId) {
      throw new PaymentException('Razorpay payment ID not found', 'MISSING_RAZORPAY_PAYMENT_ID', { 
        paymentId: payment.id
      });
    }

    const amountToRefund = refundAmount || payment.amount;

    if (amountToRefund > payment.amount) {
      throw new PaymentException('Refund amount cannot exceed payment amount', 'REFUND_AMOUNT_EXCEEDS_PAYMENT', { 
        refundAmount: amountToRefund,
        paymentAmount: payment.amount
      });
    }

    // Create Razorpay refund
    const razorpayRefund = await this.razorpayService.refundPayment(
      payment.razorpayPaymentId,
      amountToRefund,
      { reason: reason || 'Refund requested' }
    );

    // Use transaction to ensure data consistency
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Update payment record
      payment.status = PaymentStatus.REFUNDED;
      payment.metadata = {
        ...payment.metadata,
        refund: {
          id: razorpayRefund.id,
          amount: amountToRefund,
          reason: reason || 'Refund requested',
          status: razorpayRefund.status,
        },
      };

      await this.paymentRepository.update(payment.id, payment);

      // Deduct credits from user account
      if (payment.creditTransactionId) {
        await this.creditsService.deductCredits(
          payment.userId,
          payment.creditsAmount,
          'payment_refund',
          { description: `Refund for payment ${payment.id}` }
        );
      }

      await queryRunner.commitTransaction();

      this.logger.log(`Payment ${paymentId} refunded successfully`);

      return {
        success: true,
        refundId: razorpayRefund.id,
        message: 'Payment refunded successfully',
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error refunding payment ${paymentId}:`, error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Get payment history with filters
   */
  async getPaymentHistory(
    userId: string,
    page: number = 1,
    limit: number = 10,
    status?: PaymentStatus,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    payments: Payment[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    // Get all payments for user and filter in memory (simplified approach)
    const allPayments = await this.paymentRepository.findByUserId(userId);
    
    let filteredPayments = allPayments;
    
    if (status) {
      filteredPayments = filteredPayments.filter(p => p.status === status);
    }
    
    if (startDate) {
      filteredPayments = filteredPayments.filter(p => p.createdAt >= startDate);
    }
    
    if (endDate) {
      filteredPayments = filteredPayments.filter(p => p.createdAt <= endDate);
    }
    
    // Sort by creation date (newest first)
    filteredPayments.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    // Apply pagination
    const total = filteredPayments.length;
    const payments = filteredPayments.slice((page - 1) * limit, page * limit);

    const totalPages = Math.ceil(total / limit);

    this.logger.log(`Payment history retrieved for user ${userId}: ${payments.length} payments`);

    return {
      payments,
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Get payment by Razorpay order ID
   */
  async getPaymentByRazorpayOrderId(razorpayOrderId: string): Promise<Payment | null> {
    const payment = await this.paymentRepository.findOne({
      where: { razorpayOrderId },
    });

    if (payment) {
      this.logger.log(`Payment found for Razorpay order ${razorpayOrderId}`);
    }

    return payment;
  }

  /**
   * Update payment status
   */
  async updatePaymentStatus(
    paymentId: string,
    status: PaymentStatus,
    metadata?: any
  ): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new ResourceNotFoundException('Payment', 'PAYMENT_NOT_FOUND', { paymentId });
    }

    payment.status = status;
    if (metadata) {
      payment.metadata = { ...payment.metadata, ...metadata };
    }

    // Status-specific metadata can be added here if needed

    await this.paymentRepository.save(payment);

    this.logger.log(`Payment ${paymentId} status updated to ${status}`);

    return payment;
  }

  /**
   * Get payments by status
   */
  async getPaymentsByStatus(
    status: PaymentStatus,
    limit: number = 100
  ): Promise<Payment[]> {
    const payments = await this.paymentRepository.find({
      where: { status },
      order: { createdAt: 'DESC' },
      take: limit,
    });

    this.logger.log(`Retrieved ${payments.length} payments with status ${status}`);

    return payments;
  }
}
