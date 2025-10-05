import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Payment, PaymentStatus, PaymentMethod } from '../../../entities';
import { RazorpayService } from './razorpay.service';
import { CreditsService } from '../../credits/services/credits.service';

@Injectable()
export class PaymentOperationsService {
  private readonly logger = new Logger(PaymentOperationsService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
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
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.status !== PaymentStatus.COMPLETED) {
      throw new BadRequestException('Only completed payments can be refunded');
    }

    if (payment.method !== PaymentMethod.RAZORPAY) {
      throw new BadRequestException('Only Razorpay payments can be refunded');
    }

    if (!payment.razorpayPaymentId) {
      throw new BadRequestException('Razorpay payment ID not found');
    }

    const amountToRefund = refundAmount || payment.amount;

    if (amountToRefund > payment.amount) {
      throw new BadRequestException('Refund amount cannot exceed payment amount');
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

      await queryRunner.manager.save(payment);

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
    const queryBuilder = this.paymentRepository
      .createQueryBuilder('payment')
      .where('payment.userId = :userId', { userId });

    if (status) {
      queryBuilder.andWhere('payment.status = :status', { status });
    }

    if (startDate) {
      queryBuilder.andWhere('payment.createdAt >= :startDate', { startDate });
    }

    if (endDate) {
      queryBuilder.andWhere('payment.createdAt <= :endDate', { endDate });
    }

    const [payments, total] = await queryBuilder
      .orderBy('payment.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

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
      throw new NotFoundException('Payment not found');
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
