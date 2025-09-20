import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment, PaymentStatus } from '../../../entities';

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
export class PaymentHistoryService {
    constructor(
        @InjectRepository(Payment)
        private readonly paymentRepository: Repository<Payment>,
    ) { }

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
        const averageOrderValue = totalSuccessfulPayments > 0 ? totalRevenue / totalSuccessfulPayments : 0;

        // Top packages
        const topPackages = await this.paymentRepository
            .createQueryBuilder('payment')
            .select([
                'payment.packageId',
                'payment.packageName',
                'COUNT(*) as totalSales',
                'SUM(payment.amount) as totalRevenue',
            ])
            .where('payment.status = :status', { status: PaymentStatus.COMPLETED })
            .andWhere('payment.createdAt >= :startDate', { startDate })
            .groupBy('payment.packageId, payment.packageName')
            .orderBy('totalRevenue', 'DESC')
            .limit(5)
            .getRawMany();

        // Monthly revenue (last 12 months)
        const monthlyRevenue = await this.paymentRepository
            .createQueryBuilder('payment')
            .select([
                'DATE_TRUNC(\'month\', payment.createdAt) as month',
                'SUM(payment.amount) as revenue',
                'COUNT(*) as payments',
            ])
            .where('payment.status = :status', { status: PaymentStatus.COMPLETED })
            .andWhere('payment.createdAt >= :startDate', {
                startDate: new Date(new Date().setFullYear(new Date().getFullYear() - 1))
            })
            .groupBy('DATE_TRUNC(\'month\', payment.createdAt)')
            .orderBy('month', 'ASC')
            .getRawMany();

        // Payment method distribution
        const paymentMethodDistribution = await this.paymentRepository
            .createQueryBuilder('payment')
            .select([
                'payment.method',
                'COUNT(*) as count',
                'SUM(payment.amount) as revenue',
            ])
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

    async getUserPaymentSummary(userId: string): Promise<{
        totalSpent: number;
        totalCreditsEarned: number;
        totalPayments: number;
        favoritePackage: string | null;
        firstPaymentDate: Date | null;
        lastPaymentDate: Date | null;
    }> {
        const summary = await this.paymentRepository
            .createQueryBuilder('payment')
            .select([
                'SUM(payment.amount) as totalSpent',
                'SUM(payment.creditsAmount) as totalCreditsEarned',
                'COUNT(*) as totalPayments',
                'MIN(payment.createdAt) as firstPaymentDate',
                'MAX(payment.createdAt) as lastPaymentDate',
            ])
            .where('payment.userId = :userId', { userId })
            .andWhere('payment.status = :status', { status: PaymentStatus.COMPLETED })
            .getRawOne();

        // Find favorite package
        const favoritePackageResult = await this.paymentRepository
            .createQueryBuilder('payment')
            .select(['payment.packageName', 'COUNT(*) as count'])
            .where('payment.userId = :userId', { userId })
            .andWhere('payment.status = :status', { status: PaymentStatus.COMPLETED })
            .groupBy('payment.packageName')
            .orderBy('count', 'DESC')
            .limit(1)
            .getRawOne();

        return {
            totalSpent: parseFloat(summary.totalSpent) || 0,
            totalCreditsEarned: parseFloat(summary.totalCreditsEarned) || 0,
            totalPayments: parseInt(summary.totalPayments) || 0,
            favoritePackage: favoritePackageResult?.payment_packageName || null,
            firstPaymentDate: summary.firstPaymentDate ? new Date(summary.firstPaymentDate) : null,
            lastPaymentDate: summary.lastPaymentDate ? new Date(summary.lastPaymentDate) : null,
        };
    }

    async getRecentPayments(limit: number = 10): Promise<Payment[]> {
        return this.paymentRepository.find({
            order: { createdAt: 'DESC' },
            take: limit,
            relations: ['user'],
        });
    }

    async getFailedPayments(days: number = 7): Promise<Payment[]> {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        return this.paymentRepository.find({
            where: {
                status: PaymentStatus.FAILED,
                createdAt: { $gte: startDate } as any,
            },
            order: { createdAt: 'DESC' },
            relations: ['user'],
        });
    }
}