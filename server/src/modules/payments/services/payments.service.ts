import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Payment, PaymentStatus, PaymentMethod, User } from '../../../entities';
import { RazorpayService } from './razorpay.service';
import { CreditsService } from '../../credits/services/credits.service';
import { getPackageById, calculateTotalCredits } from '../../../config';
import { paymentConfig } from '../../../config';
import {
  CreatePaymentOrderDto,
  VerifyPaymentDto,
  PaymentOrderResponse,
  PaymentVerificationResponse,
  PaymentHistoryQueryDto,
  PaymentHistoryResponse,
} from '../dto/payment.dto';

export interface PaymentAnalytics {
  totalRevenue: number;
  totalSuccessfulPayments: number;
  totalFailedPayments: number;
  averageOrderValue: number;
  topPackages: Array<{
    packageId: string;
    packageName: string;
    totalSales: number;
    totalRevenue: number;
  }>;
  monthlyRevenue: Array<{
    month: string;
    revenue: number;
    payments: number;
  }>;
  paymentMethodDistribution: Array<{
    method: string;
    count: number;
    revenue: number;
  }>;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly config = paymentConfig();

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly razorpayService: RazorpayService,
    private readonly creditsService: CreditsService,
    private readonly dataSource: DataSource
  ) {}

  async createPaymentOrder(
    userId: string,
    createOrderDto: CreatePaymentOrderDto
  ): Promise<PaymentOrderResponse> {
    const { packageId, notes } = createOrderDto;

    // Get user details
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get package details
    const package_ = getPackageById(packageId);
    if (!package_ || !package_.isActive) {
      throw new BadRequestException('Invalid or inactive package');
    }

    const totalCredits = calculateTotalCredits(packageId);
    const bonusCredits = totalCredits - package_.credits;

    // Create Razorpay order
    const receipt = `order_${Date.now()}`;
    const razorpayNotes = {
      userId,
      packageId,
      userEmail: user.email,
      notes: notes || '',
    };

    const razorpayOrder = await this.razorpayService.createOrder(
      package_.price,
      package_.currency,
      receipt,
      razorpayNotes
    );

    // Save payment record
    const payment = this.paymentRepository.create({
      userId,
      razorpayOrderId: razorpayOrder.id,
      packageId,
      packageName: package_.name,
      amount: package_.price,
      currency: package_.currency,
      creditsAmount: totalCredits,
      status: PaymentStatus.PENDING,
      method: PaymentMethod.RAZORPAY,
      metadata: {
        package: package_,
        bonusCredits,
        receipt,
        notes,
      },
    });

    await this.paymentRepository.save(payment);

    return {
      orderId: razorpayOrder.id,
      amount: package_.price,
      currency: package_.currency,
      packageDetails: {
        id: package_.id,
        name: package_.name,
        credits: package_.credits,
        bonusCredits,
        totalCredits,
      },
      razorpayKeyId: this.config.razorpay.keyId || '',
      user: {
        id: user.id,
        email: user.email,
      },
    };
  }

  async verifyAndCompletePayment(
    verifyDto: VerifyPaymentDto
  ): Promise<PaymentVerificationResponse> {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = verifyDto;

    return this.dataSource.transaction(async manager => {
      // Find payment record
      const payment = await manager.findOne(Payment, {
        where: { razorpayOrderId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!payment) {
        throw new NotFoundException('Payment not found');
      }

      if (payment.status === PaymentStatus.COMPLETED) {
        throw new ConflictException('Payment already completed');
      }

      // Verify payment signature
      const isValid = this.razorpayService.verifyPaymentSignature({
        razorpay_order_id: razorpayOrderId,
        razorpay_payment_id: razorpayPaymentId,
        razorpay_signature: razorpaySignature,
      });

      if (!isValid) {
        payment.status = PaymentStatus.FAILED;
        payment.failureReason = 'Invalid payment signature';
        await manager.save(payment);
        throw new BadRequestException('Payment verification failed');
      }

      // Fetch payment details from Razorpay
      const razorpayPayment = await this.razorpayService.fetchPayment(razorpayPaymentId);

      if (razorpayPayment.status !== 'captured') {
        payment.status = PaymentStatus.FAILED;
        payment.failureReason = `Payment not captured. Status: ${razorpayPayment.status}`;
        await manager.save(payment);
        throw new BadRequestException('Payment not successful');
      }

      // Update payment record
      payment.razorpayPaymentId = razorpayPaymentId;
      payment.razorpaySignature = razorpaySignature;
      payment.status = PaymentStatus.COMPLETED;
      payment.metadata = {
        ...payment.metadata,
        razorpayPayment: {
          method: razorpayPayment.method,
          bank: razorpayPayment.bank,
          wallet: razorpayPayment.wallet,
          vpa: razorpayPayment.vpa,
          card_id: razorpayPayment.card_id,
        },
      };

      await manager.save(payment);

      // Add credits to user account with idempotency
      await this.creditsService.addCreditsIdempotent(
        payment.userId,
        payment.creditsAmount,
        `Package purchase: ${payment.packageName}`,
        { paymentId: razorpayPaymentId, packageId: payment.packageId }
      );

      this.logger.log(`Credits added for payment ${razorpayPaymentId}`);

      // Update payment status
      payment.status = PaymentStatus.COMPLETED;
      await manager.save(payment);

      return {
        success: true,
        payment: {
          id: payment.id,
          orderId: payment.razorpayOrderId,
          paymentId: payment.razorpayPaymentId,
          status: payment.status,
          amount: payment.amount,
          creditsAdded: payment.creditsAmount,
          newBalance: await this.creditsService.getBalance(payment.userId),
        },
      };
    });
  }

  async getPaymentById(paymentId: string, userId: string): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId, userId },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return payment;
  }

  async cancelPayment(paymentId: string, userId: string): Promise<void> {
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId, userId },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException('Only pending payments can be cancelled');
    }

    payment.status = PaymentStatus.CANCELLED;
    await this.paymentRepository.save(payment);
  }

  async getPaymentStats(userId: string): Promise<{
    totalSpent: number;
    totalPayments: number;
    successfulPayments: number;
    failedPayments: number;
    averageOrderValue: number;
  }> {
    const stats = await this.paymentRepository
      .createQueryBuilder('payment')
      .select([
        'COUNT(*) as totalPayments',
        'SUM(CASE WHEN payment.status = :completed THEN payment.amount ELSE 0 END) as totalSpent',
        'COUNT(CASE WHEN payment.status = :completed THEN 1 END) as successfulPayments',
        'COUNT(CASE WHEN payment.status = :failed THEN 1 END) as failedPayments',
      ])
      .where('payment.userId = :userId', { userId })
      .setParameters({
        completed: PaymentStatus.COMPLETED,
        failed: PaymentStatus.FAILED,
      })
      .getRawOne();

    const totalPayments = parseInt(stats.totalPayments) || 0;
    const totalSpent = parseFloat(stats.totalSpent) || 0;
    const successfulPayments = parseInt(stats.successfulPayments) || 0;
    const failedPayments = parseInt(stats.failedPayments) || 0;
    const averageOrderValue = successfulPayments > 0 ? totalSpent / successfulPayments : 0;

    return {
      totalSpent,
      totalPayments,
      successfulPayments,
      failedPayments,
      averageOrderValue,
    };
  }

  async refundPayment(
    paymentId: string,
    userId: string,
    refundDto: { amount?: number; reason?: string }
  ): Promise<{ success: boolean; refundId?: string; message: string }> {
    return this.dataSource.transaction(async manager => {
      // Find payment record
      const payment = await manager.findOne(Payment, {
        where: { id: paymentId, userId },
        lock: { mode: 'pessimistic_write' },
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
        throw new BadRequestException('Payment ID not found for refund');
      }

      // Process refund with Razorpay
      const refundAmount = refundDto.amount || payment.amount;
      const refundNotes = {
        reason: refundDto.reason || 'Customer request',
        refundedBy: userId,
        originalPaymentId: payment.id,
      };

      const razorpayRefund = await this.razorpayService.refundPayment(
        payment.razorpayPaymentId,
        refundAmount,
        refundNotes
      );

      // Update payment status
      payment.status = PaymentStatus.REFUNDED;
      payment.metadata = {
        ...payment.metadata,
        refund: {
          refundId: razorpayRefund.id,
          amount: refundAmount,
          reason: refundDto.reason,
          processedAt: new Date().toISOString(),
        },
      };

      await manager.save(payment);

      // Deduct credits if full refund
      if (refundAmount >= payment.amount) {
        await this.creditsService.deductCredits(
          userId,
          payment.creditsAmount,
          `Refund for payment: ${payment.packageName}`,
          { paymentId: payment.razorpayPaymentId }
        );
      }

      this.logger.log(`Payment refunded: ${payment.id}, amount: ${refundAmount}`);

      return {
        success: true,
        refundId: razorpayRefund.id,
        message: 'Refund processed successfully',
      };
    });
  }

  async retryFailedPaymentProcessing(
    paymentId: string
  ): Promise<{ success: boolean; message: string }> {
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
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
      return { success: true, message: 'Payment retry successful' };
    } else {
      this.logger.log(
        `Payment still failed after retry: ${payment.id}, status: ${razorpayPayment.status}`
      );
      return { success: false, message: 'Payment still failed after retry' };
    }
  }

  async reconcilePayments(
    userId: string,
    options: { days?: number } = {}
  ): Promise<{ reconciledCount: number }> {
    const days = options.days || 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Find payments that might need reconciliation
    const payments = await this.paymentRepository.find({
      where: {
        userId,
        status: PaymentStatus.PENDING,
        createdAt: { $gte: startDate } as any,
      },
    });

    let reconciledCount = 0;

    for (const payment of payments) {
      if (payment.razorpayOrderId) {
        try {
          // Check Razorpay order status
          const razorpayOrder = await this.razorpayService.fetchOrder(payment.razorpayOrderId);

          if (razorpayOrder.status === 'paid') {
            // Order is paid, update our records
            payment.status = PaymentStatus.COMPLETED;
            await this.paymentRepository.save(payment);
            reconciledCount++;
          }
        } catch (error) {
          this.logger.warn(`Failed to reconcile payment ${payment.id}:`, error);
        }
      }
    }

    this.logger.log(`Reconciled ${reconciledCount} payments for user ${userId}`);
    return { reconciledCount };
  }

  // Analytics methods (moved from PaymentHistoryService)
  async getPaymentAnalytics(days: number = 30): Promise<PaymentAnalytics> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    // Basic stats
    const basicStats = await this.paymentRepository
      .createQueryBuilder('payment')
      .select([
        'SUM(CASE WHEN payment.status = :completed THEN payment.amount ELSE 0 END) as totalRevenue',
        'COUNT(CASE WHEN payment.status = :completed THEN 1 END) as totalSuccessfulPayments',
        'COUNT(CASE WHEN payment.status = :failed THEN 1 END) as totalFailedPayments',
      ])
      .where('payment.createdAt >= :startDate', { startDate })
      .setParameters({
        completed: PaymentStatus.COMPLETED,
        failed: PaymentStatus.FAILED,
      })
      .getRawOne();

    const totalRevenue = parseFloat(basicStats.totalRevenue) || 0;
    const totalSuccessfulPayments = parseInt(basicStats.totalSuccessfulPayments) || 0;
    const totalFailedPayments = parseInt(basicStats.totalFailedPayments) || 0;
    const averageOrderValue =
      totalSuccessfulPayments > 0 ? totalRevenue / totalSuccessfulPayments : 0;

    // Top packages
    const topPackages = await this.paymentRepository
      .createQueryBuilder('payment')
      .select([
        'payment.packageId as packageId',
        'payment.packageName as packageName',
        'COUNT(*) as totalSales',
        'SUM(payment.amount) as totalRevenue',
      ])
      .where('payment.status = :status', { status: PaymentStatus.COMPLETED })
      .andWhere('payment.createdAt >= :startDate', { startDate })
      .groupBy('payment.packageId, payment.packageName')
      .orderBy('totalSales', 'DESC')
      .limit(5)
      .getRawMany();

    // Monthly revenue
    const monthlyRevenue = await this.paymentRepository
      .createQueryBuilder('payment')
      .select([
        "TO_CHAR(payment.createdAt, 'YYYY-MM') as month",
        'SUM(payment.amount) as revenue',
        'COUNT(*) as payments',
      ])
      .where('payment.status = :status', { status: PaymentStatus.COMPLETED })
      .andWhere('payment.createdAt >= :startDate', { startDate })
      .groupBy("TO_CHAR(payment.createdAt, 'YYYY-MM')")
      .orderBy('month', 'ASC')
      .getRawMany();

    // Payment method distribution
    const paymentMethodDistribution = await this.paymentRepository
      .createQueryBuilder('payment')
      .select(['payment.method as method', 'COUNT(*) as count', 'SUM(payment.amount) as revenue'])
      .where('payment.status = :status', { status: PaymentStatus.COMPLETED })
      .andWhere('payment.createdAt >= :startDate', { startDate })
      .groupBy('payment.method')
      .getRawMany();

    return {
      totalRevenue,
      totalSuccessfulPayments,
      totalFailedPayments,
      averageOrderValue,
      topPackages: topPackages.map(pkg => ({
        packageId: pkg.packageId,
        packageName: pkg.packageName,
        totalSales: parseInt(pkg.totalSales),
        totalRevenue: parseFloat(pkg.totalRevenue),
      })),
      monthlyRevenue: monthlyRevenue.map(month => ({
        month: month.month,
        revenue: parseFloat(month.revenue),
        payments: parseInt(month.payments),
      })),
      paymentMethodDistribution: paymentMethodDistribution.map(method => ({
        method: method.method,
        count: parseInt(method.count),
        revenue: parseFloat(method.revenue),
      })),
    };
  }

  async getPaymentHistory(
    userId: string,
    query: PaymentHistoryQueryDto
  ): Promise<PaymentHistoryResponse> {
    const { page = 1, limit = 10, status, startDate, endDate } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.paymentRepository
      .createQueryBuilder('payment')
      .where('payment.userId = :userId', { userId })
      .orderBy('payment.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (status) {
      queryBuilder.andWhere('payment.status = :status', { status });
    }

    if (startDate) {
      queryBuilder.andWhere('payment.createdAt >= :startDate', { startDate });
    }

    if (endDate) {
      queryBuilder.andWhere('payment.createdAt <= :endDate', { endDate });
    }

    const [payments, total] = await queryBuilder.getManyAndCount();

    return {
      payments: payments.map(payment => ({
        id: payment.id,
        packageId: payment.packageId,
        packageName: payment.packageName,
        amount: payment.amount,
        currency: payment.currency,
        creditsAmount: payment.creditsAmount,
        status: payment.status,
        method: payment.method,
        createdAt: payment.createdAt,
        completedAt: payment.status === PaymentStatus.COMPLETED ? payment.updatedAt : undefined,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getRecentPayments(limit: number = 10): Promise<any[]> {
    return this.paymentRepository
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.user', 'user')
      .select([
        'payment.id',
        'payment.packageName',
        'payment.amount',
        'payment.status',
        'payment.createdAt',
        'user.email',
        'user.name',
      ])
      .orderBy('payment.createdAt', 'DESC')
      .limit(limit)
      .getMany();
  }

  async getFailedPayments(limit: number = 10): Promise<any[]> {
    return this.paymentRepository
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.user', 'user')
      .select([
        'payment.id',
        'payment.packageName',
        'payment.amount',
        'payment.status',
        'payment.failureReason',
        'payment.createdAt',
        'user.email',
        'user.name',
      ])
      .where('payment.status = :status', { status: PaymentStatus.FAILED })
      .orderBy('payment.createdAt', 'DESC')
      .limit(limit)
      .getMany();
  }

  async getUserPaymentSummary(userId: string): Promise<any> {
    const summary = await this.paymentRepository
      .createQueryBuilder('payment')
      .select([
        'COUNT(*) as totalPayments',
        'SUM(CASE WHEN payment.status = :completed THEN payment.amount ELSE 0 END) as totalSpent',
        'SUM(CASE WHEN payment.status = :completed THEN payment.creditsAmount ELSE 0 END) as totalCreditsPurchased',
      ])
      .where('payment.userId = :userId', { userId })
      .setParameters({
        completed: PaymentStatus.COMPLETED,
      })
      .getRawOne();

    return {
      totalPayments: parseInt(summary.totalPayments) || 0,
      totalSpent: parseFloat(summary.totalSpent) || 0,
      totalCreditsPurchased: parseInt(summary.totalCreditsPurchased) || 0,
    };
  }
}
