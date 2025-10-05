import { Injectable, Logger } from '@nestjs/common';
import { Payment, PaymentStatus } from '../../../entities';
import { IPaymentRepository } from '../../../core/repositories/interfaces';

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
export class PaymentAnalyticsService {
  private readonly logger = new Logger(PaymentAnalyticsService.name);

  constructor(
    private readonly paymentRepository: IPaymentRepository,
  ) {}

  /**
   * Get payment analytics for a specific period
   */
  async getPaymentAnalytics(days: number = 30): Promise<PaymentAnalytics> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get all payments and filter by date (simplified approach)
    const payments = await this.paymentRepository.findAll();
    const filteredPayments = payments.filter(p => p.createdAt >= startDate);

    const successfulPayments = filteredPayments.filter(p => p.status === PaymentStatus.COMPLETED);
    const failedPayments = filteredPayments.filter(p => p.status === PaymentStatus.FAILED);

    const totalRevenue = successfulPayments.reduce((sum, p) => sum + p.amount, 0);
    const averageOrderValue = successfulPayments.length > 0 ? totalRevenue / successfulPayments.length : 0;

    // Top packages
    const packageStats = new Map<string, { name: string; sales: number; revenue: number }>();
    successfulPayments.forEach(payment => {
      const existing = packageStats.get(payment.packageId) || { name: payment.packageName, sales: 0, revenue: 0 };
      existing.sales += 1;
      existing.revenue += payment.amount;
      packageStats.set(payment.packageId, existing);
    });

    const topPackages = Array.from(packageStats.entries())
      .map(([packageId, stats]) => ({
        packageId,
        packageName: stats.name,
        totalSales: stats.sales,
        totalRevenue: stats.revenue,
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 10);

    // Monthly revenue
    const monthlyRevenue = new Map<string, { revenue: number; payments: number }>();
    successfulPayments.forEach(payment => {
      const month = payment.createdAt.toISOString().substring(0, 7); // YYYY-MM
      const existing = monthlyRevenue.get(month) || { revenue: 0, payments: 0 };
      existing.revenue += payment.amount;
      existing.payments += 1;
      monthlyRevenue.set(month, existing);
    });

    const monthlyRevenueArray = Array.from(monthlyRevenue.entries())
      .map(([month, stats]) => ({
        month,
        revenue: stats.revenue,
        payments: stats.payments,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // Payment method distribution
    const methodStats = new Map<string, { count: number; revenue: number }>();
    successfulPayments.forEach(payment => {
      const method = payment.method;
      const existing = methodStats.get(method) || { count: 0, revenue: 0 };
      existing.count += 1;
      existing.revenue += payment.amount;
      methodStats.set(method, existing);
    });

    const paymentMethodDistribution = Array.from(methodStats.entries())
      .map(([method, stats]) => ({
        method,
        count: stats.count,
        revenue: stats.revenue,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    this.logger.log(`Payment analytics generated for ${days} days`);

    return {
      totalRevenue,
      totalSuccessfulPayments: successfulPayments.length,
      totalFailedPayments: failedPayments.length,
      averageOrderValue,
      topPackages,
      monthlyRevenue: monthlyRevenueArray,
      paymentMethodDistribution,
    };
  }

  /**
   * Get recent payments
   */
  async getRecentPayments(limit: number = 10): Promise<any[]> {
    const payments = await this.paymentRepository.find({
      order: { createdAt: 'DESC' },
      take: limit,
    });

    this.logger.log(`Retrieved ${payments.length} recent payments`);
    return payments;
  }

  /**
   * Get failed payments
   */
  async getFailedPayments(limit: number = 10): Promise<any[]> {
    const payments = await this.paymentRepository.find({
      where: { status: PaymentStatus.FAILED },
      order: { createdAt: 'DESC' },
      take: limit,
    });

    this.logger.log(`Retrieved ${payments.length} failed payments`);
    return payments;
  }

  /**
   * Get user payment summary
   */
  async getUserPaymentSummary(userId: string): Promise<any> {
    const payments = await this.paymentRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    const summary = {
      totalPayments: payments.length,
      successfulPayments: payments.filter(p => p.status === PaymentStatus.COMPLETED).length,
      failedPayments: payments.filter(p => p.status === PaymentStatus.FAILED).length,
      totalAmount: payments
        .filter(p => p.status === PaymentStatus.COMPLETED)
        .reduce((sum, p) => sum + p.amount, 0),
      totalCredits: payments
        .filter(p => p.status === PaymentStatus.COMPLETED)
        .reduce((sum, p) => sum + p.creditsAmount, 0),
      recentPayments: payments.slice(0, 5),
    };

    this.logger.log(`Payment summary generated for user ${userId}`);
    return summary;
  }
}
