import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Payment, PaymentStatus, PaymentMethod, User } from '../../../entities';
import { RazorpayService } from './razorpay.service';
import { CreditsService } from '../../credits/services/credits.service';
import { PaymentOrderService } from './payment-order.service';
import { PaymentVerificationService } from './payment-verification.service';
import { PaymentAnalyticsService, PaymentAnalytics } from './payment-analytics.service';
import { PaymentOperationsService } from './payment-operations.service';
import { IPaymentRepository, IUserRepository } from '../../../core/repositories/interfaces';
import {
  CreatePaymentOrderDto,
  VerifyPaymentDto,
  PaymentOrderResponse,
  PaymentVerificationResponse,
  PaymentHistoryQueryDto,
  PaymentHistoryResponse,
} from '../dto/payment.dto';
// Re-export interfaces for external use
export { PaymentAnalytics } from './payment-analytics.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly paymentRepository: IPaymentRepository,
    private readonly userRepository: IUserRepository,
    private readonly razorpayService: RazorpayService,
    private readonly creditsService: CreditsService,
    private readonly dataSource: DataSource,
    private readonly paymentOrderService: PaymentOrderService,
    private readonly paymentVerificationService: PaymentVerificationService,
    private readonly paymentAnalyticsService: PaymentAnalyticsService,
    private readonly paymentOperationsService: PaymentOperationsService,
  ) {}

  // Payment Order Management
  async createPaymentOrder(
    userId: string,
    createOrderDto: CreatePaymentOrderDto
  ): Promise<PaymentOrderResponse> {
    return this.paymentOrderService.createPaymentOrder(userId, createOrderDto);
  }

  async getPaymentById(paymentId: string, userId: string): Promise<Payment> {
    return this.paymentOrderService.getPaymentById(paymentId, userId);
  }

  async cancelPayment(paymentId: string, userId: string): Promise<void> {
    return this.paymentOrderService.cancelPayment(paymentId, userId);
  }

  async getPaymentStats(userId: string): Promise<{
    totalPayments: number;
    successfulPayments: number;
    failedPayments: number;
    totalAmount: number;
    totalCredits: number;
  }> {
    return this.paymentOrderService.getPaymentStats(userId);
  }

  // Payment Verification
  async verifyAndCompletePayment(
    verifyDto: VerifyPaymentDto
  ): Promise<PaymentVerificationResponse> {
    return this.paymentVerificationService.verifyAndCompletePayment(verifyDto);
  }

  async retryFailedPaymentProcessing(
    paymentId: string
  ): Promise<PaymentVerificationResponse> {
    return this.paymentVerificationService.retryFailedPaymentProcessing(paymentId);
  }

  async reconcilePayments(): Promise<{
    reconciled: number;
    failed: number;
    errors: string[];
  }> {
    return this.paymentVerificationService.reconcilePayments();
  }

  // Payment Analytics
  async getPaymentAnalytics(days: number = 30): Promise<PaymentAnalytics> {
    return this.paymentAnalyticsService.getPaymentAnalytics(days);
  }

  async getRecentPayments(limit: number = 10): Promise<any[]> {
    return this.paymentAnalyticsService.getRecentPayments(limit);
  }

  async getFailedPayments(limit: number = 10): Promise<any[]> {
    return this.paymentAnalyticsService.getFailedPayments(limit);
  }

  async getUserPaymentSummary(userId: string): Promise<any> {
    return this.paymentAnalyticsService.getUserPaymentSummary(userId);
  }

  // Payment Operations
  async refundPayment(
    paymentId: string,
    refundAmount?: number,
    reason?: string
  ): Promise<{
    success: boolean;
    refundId?: string;
    message: string;
  }> {
    return this.paymentOperationsService.refundPayment(paymentId, refundAmount, reason);
  }

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
    return this.paymentOperationsService.getPaymentHistory(
      userId,
      page,
      limit,
      status,
      startDate,
      endDate
    );
  }

  async getPaymentByRazorpayOrderId(razorpayOrderId: string): Promise<Payment | null> {
    return this.paymentOperationsService.getPaymentByRazorpayOrderId(razorpayOrderId);
  }

  async updatePaymentStatus(
    paymentId: string,
    status: PaymentStatus,
    metadata?: any
  ): Promise<Payment> {
    return this.paymentOperationsService.updatePaymentStatus(paymentId, status, metadata);
  }

  async getPaymentsByStatus(
    status: PaymentStatus,
    limit: number = 100
  ): Promise<Payment[]> {
    return this.paymentOperationsService.getPaymentsByStatus(status, limit);
  }
}