import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment, PaymentStatus, PaymentMethod, User } from '../../../entities';
import { RazorpayService } from './razorpay.service';
import { getPackageById, calculateTotalCredits } from '../../../config';
import { paymentConfig } from '../../../config';
import {
  CreatePaymentOrderDto,
  PaymentOrderResponse,
} from '../dto/payment.dto';

@Injectable()
export class PaymentOrderService {
  private readonly logger = new Logger(PaymentOrderService.name);
  private readonly config = paymentConfig();

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly razorpayService: RazorpayService,
  ) {}

  /**
   * Create a new payment order
   */
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

    this.logger.log(`Payment order created for user ${userId}, package ${packageId}`);

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

  /**
   * Get payment by ID
   */
  async getPaymentById(paymentId: string, userId: string): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId, userId },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return payment;
  }

  /**
   * Cancel a payment
   */
  async cancelPayment(paymentId: string, userId: string): Promise<void> {
    const payment = await this.getPaymentById(paymentId, userId);

    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException('Only pending payments can be cancelled');
    }

    payment.status = PaymentStatus.CANCELLED;
    await this.paymentRepository.save(payment);

    this.logger.log(`Payment ${paymentId} cancelled for user ${userId}`);
  }

  /**
   * Get payment statistics for a user
   */
  async getPaymentStats(userId: string): Promise<{
    totalPayments: number;
    successfulPayments: number;
    failedPayments: number;
    totalAmount: number;
    totalCredits: number;
  }> {
    const payments = await this.paymentRepository.find({
      where: { userId },
    });

    const stats = {
      totalPayments: payments.length,
      successfulPayments: payments.filter(p => p.status === PaymentStatus.COMPLETED).length,
      failedPayments: payments.filter(p => p.status === PaymentStatus.FAILED).length,
      totalAmount: payments
        .filter(p => p.status === PaymentStatus.COMPLETED)
        .reduce((sum, p) => sum + p.amount, 0),
      totalCredits: payments
        .filter(p => p.status === PaymentStatus.COMPLETED)
        .reduce((sum, p) => sum + p.creditsAmount, 0),
    };

    this.logger.log(`Payment stats retrieved for user ${userId}`);
    return stats;
  }
}
