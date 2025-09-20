import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Payment, PaymentStatus, PaymentMethod, User } from '../../../entities';
import { RazorpayService } from './razorpay.service';
import { CreditsService } from '../../credits/services/credits.service';
import { getPackageById, calculateTotalCredits } from '../../../config/credit-packages.config';
import {
    CreatePaymentOrderDto,
    VerifyPaymentDto,
    PaymentOrderResponse,
    PaymentVerificationResponse,
    PaymentHistoryQueryDto,
    PaymentHistoryResponse
} from '../dto/payment.dto';

@Injectable()
export class PaymentsService {
    constructor(
        @InjectRepository(Payment)
        private readonly paymentRepository: Repository<Payment>,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        private readonly razorpayService: RazorpayService,
        private readonly creditsService: CreditsService,
        private readonly dataSource: DataSource,
    ) { }

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
            razorpayKeyId: process.env.RAZORPAY_KEY_ID,
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

        return this.dataSource.transaction(async (manager) => {
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

            // Add credits to user account
            const creditResult = await this.creditsService.addCredits(
                payment.userId,
                payment.creditsAmount,
                `Package purchase: ${payment.packageName}`,
                razorpayPaymentId,
                payment.packageId
            );

            // Update payment with credit transaction ID
            payment.creditTransactionId = creditResult.transaction.id;
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
                    newBalance: creditResult.newBalance,
                },
            };
        });
    }

    async getPaymentHistory(
        userId: string,
        query: PaymentHistoryQueryDto
    ): Promise<{ payments: PaymentHistoryResponse[]; total: number }> {
        const { limit = 20, offset = 0, status } = query;

        const queryBuilder = this.paymentRepository
            .createQueryBuilder('payment')
            .where('payment.userId = :userId', { userId })
            .orderBy('payment.createdAt', 'DESC');

        if (status) {
            queryBuilder.andWhere('payment.status = :status', { status });
        }

        const [payments, total] = await queryBuilder
            .skip(offset)
            .take(limit)
            .getManyAndCount();

        const paymentResponses: PaymentHistoryResponse[] = payments.map(payment => ({
            id: payment.id,
            packageName: payment.packageName,
            amount: payment.amount,
            currency: payment.currency,
            creditsAmount: payment.creditsAmount,
            status: payment.status,
            method: payment.method,
            createdAt: payment.createdAt,
            completedAt: payment.status === PaymentStatus.COMPLETED ? payment.updatedAt : undefined,
        }));

        return { payments: paymentResponses, total };
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
}