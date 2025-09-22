import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { JobService } from './job.service';
import { RedisService } from '../../redis/redis.service';
import { User, Chat, Message, Payment, CreditTransaction } from '../../../entities';
import { monitoringConfig } from '../../../config';

@Injectable()
export class AnalyticsJobService {
    private readonly logger = new Logger(AnalyticsJobService.name);
    private readonly config = monitoringConfig();

    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        @InjectRepository(Chat)
        private readonly chatRepository: Repository<Chat>,
        @InjectRepository(Message)
        private readonly messageRepository: Repository<Message>,
        @InjectRepository(Payment)
        private readonly paymentRepository: Repository<Payment>,
        @InjectRepository(CreditTransaction)
        private readonly transactionRepository: Repository<CreditTransaction>,
        private readonly jobService: JobService,
        private readonly redisService: RedisService,
    ) { }

    @Cron(CronExpression.EVERY_DAY_AT_2AM)
    async scheduleDailyAnalytics() {
        if (this.config.jobs.enabled) {
            await this.jobService.addAnalyticsJob({
                type: 'daily',
                metrics: ['users', 'chats', 'messages', 'credits', 'payments'],
                aggregationType: 'sum',
                outputFormat: 'json',
            });
        }
    }

    @Cron(CronExpression.EVERY_DAY_AT_3AM)
    async scheduleWeeklyAnalytics() {
        if (this.config.jobs.enabled) {
            await this.jobService.addAnalyticsJob({
                type: 'weekly',
                metrics: ['user_growth', 'revenue', 'model_usage', 'retention'],
                aggregationType: 'average',
                outputFormat: 'json',
            });
        }
    }

    @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
    async scheduleMonthlyAnalytics() {
        if (this.config.jobs.enabled) {
            await this.jobService.addAnalyticsJob({
                type: 'monthly',
                metrics: ['all'],
                aggregationType: 'sum',
                outputFormat: 'pdf',
            });
        }
    }

    async generateDailyMetrics(): Promise<any> {
        const today = new Date();
        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

        const metrics = {
            date: today.toISOString().split('T')[0],
            users: {
                total: await this.userRepository.count(),
                newToday: await this.userRepository.count({
                    where: { createdAt: { $gte: yesterday } as any },
                }),
                activeToday: await this.getActiveUsersToday(),
            },
            chats: {
                total: await this.chatRepository.count(),
                createdToday: await this.chatRepository.count({
                    where: { createdAt: { $gte: yesterday } as any },
                }),
            },
            messages: {
                total: await this.messageRepository.count(),
                sentToday: await this.messageRepository.count({
                    where: { createdAt: { $gte: yesterday } as any },
                }),
            },
            credits: {
                totalInCirculation: await this.getTotalCreditsInCirculation(),
                usedToday: await this.getCreditsUsedToday(),
                purchasedToday: await this.getCreditsPurchasedToday(),
            },
            payments: {
                totalRevenue: await this.getTotalRevenue(),
                revenueToday: await this.getRevenueToday(),
                successfulPayments: await this.getSuccessfulPaymentsToday(),
            },
        };

        // Cache metrics in Redis
        await this.redisService.set(
            `daily_metrics:${metrics.date}`,
            JSON.stringify(metrics),
            86400 // 24 hours
        );

        return metrics;
    }

    async generateWeeklyMetrics(): Promise<any> {
        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);

        const metrics = {
            weekStart: startDate.toISOString().split('T')[0],
            weekEnd: endDate.toISOString().split('T')[0],
            userGrowth: await this.getUserGrowth(startDate, endDate),
            revenue: await this.getRevenueInPeriod(startDate, endDate),
            modelUsage: await this.getModelUsageStats(startDate, endDate),
            topUsers: await this.getTopUsersByActivity(startDate, endDate),
            retention: await this.getRetentionMetrics(startDate, endDate),
        };

        // Cache weekly metrics
        await this.redisService.set(
            `weekly_metrics:${metrics.weekStart}`,
            JSON.stringify(metrics),
            604800 // 7 days
        );

        return metrics;
    }

    async generateMonthlyMetrics(): Promise<any> {
        const endDate = new Date();
        const startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

        const metrics = {
            month: `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}`,
            overview: {
                totalUsers: await this.userRepository.count(),
                newUsersThisMonth: await this.userRepository.count({
                    where: { createdAt: { $gte: startDate } as any },
                }),
                totalRevenue: await this.getRevenueInPeriod(startDate, endDate),
                totalCreditsUsed: await this.getCreditsUsedInPeriod(startDate, endDate),
            },
            trends: {
                dailyActiveUsers: await this.getDailyActiveUsersTrend(startDate, endDate),
                dailyRevenue: await this.getDailyRevenueTrend(startDate, endDate),
                modelPopularity: await this.getModelUsageStats(startDate, endDate),
            },
            insights: {
                averageSessionLength: await this.getAverageSessionLength(startDate, endDate),
                churnRate: await this.getChurnRate(startDate, endDate),
                ltv: await this.getLifetimeValue(),
            },
        };

        return metrics;
    }

    // Helper methods for analytics calculations
    private async getActiveUsersToday(): Promise<number> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const result = await this.messageRepository
            .createQueryBuilder('message')
            .innerJoin('message.chat', 'chat')
            .select('COUNT(DISTINCT chat.userId)', 'count')
            .where('message.createdAt >= :today', { today })
            .getRawOne();

        return parseInt(result.count) || 0;
    }

    private async getTotalCreditsInCirculation(): Promise<number> {
        const result = await this.userRepository
            .createQueryBuilder('user')
            .select('SUM(user.creditsBalance)', 'total')
            .getRawOne();

        return parseFloat(result.total) || 0;
    }

    private async getCreditsUsedToday(): Promise<number> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const result = await this.transactionRepository
            .createQueryBuilder('transaction')
            .select('SUM(ABS(transaction.amount))', 'total')
            .where('transaction.type = :type', { type: 'USAGE' })
            .andWhere('transaction.createdAt >= :today', { today })
            .getRawOne();

        return parseFloat(result.total) || 0;
    }

    private async getCreditsPurchasedToday(): Promise<number> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const result = await this.transactionRepository
            .createQueryBuilder('transaction')
            .select('SUM(transaction.amount)', 'total')
            .where('transaction.type = :type', { type: 'PURCHASE' })
            .andWhere('transaction.createdAt >= :today', { today })
            .getRawOne();

        return parseFloat(result.total) || 0;
    }

    private async getTotalRevenue(): Promise<number> {
        const result = await this.paymentRepository
            .createQueryBuilder('payment')
            .select('SUM(payment.amount)', 'total')
            .where('payment.status = :status', { status: 'completed' })
            .getRawOne();

        return parseFloat(result.total) || 0;
    }

    private async getRevenueToday(): Promise<number> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const result = await this.paymentRepository
            .createQueryBuilder('payment')
            .select('SUM(payment.amount)', 'total')
            .where('payment.status = :status', { status: 'completed' })
            .andWhere('payment.updatedAt >= :today', { today })
            .getRawOne();

        return parseFloat(result.total) || 0;
    }

    private async getSuccessfulPaymentsToday(): Promise<number> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return this.paymentRepository.count({
            where: {
                status: 'completed' as any,
                updatedAt: { $gte: today } as any,
            },
        });
    }

    private async getUserGrowth(startDate: Date, endDate: Date): Promise<any> {
        const result = await this.userRepository
            .createQueryBuilder('user')
            .select('DATE(user.createdAt)', 'date')
            .addSelect('COUNT(*)', 'count')
            .where('user.createdAt BETWEEN :startDate AND :endDate', { startDate, endDate })
            .groupBy('DATE(user.createdAt)')
            .orderBy('date', 'ASC')
            .getRawMany();

        return result.map(row => ({
            date: row.date,
            newUsers: parseInt(row.count),
        }));
    }

    private async getRevenueInPeriod(startDate: Date, endDate: Date): Promise<number> {
        const result = await this.paymentRepository
            .createQueryBuilder('payment')
            .select('SUM(payment.amount)', 'total')
            .where('payment.status = :status', { status: 'completed' })
            .andWhere('payment.updatedAt BETWEEN :startDate AND :endDate', { startDate, endDate })
            .getRawOne();

        return parseFloat(result.total) || 0;
    }

    private async getModelUsageStats(startDate: Date, endDate: Date): Promise<any[]> {
        const result = await this.messageRepository
            .createQueryBuilder('message')
            .select('message.model', 'model')
            .addSelect('COUNT(*)', 'count')
            .addSelect('SUM(message.creditsUsed)', 'creditsUsed')
            .where('message.model IS NOT NULL')
            .andWhere('message.createdAt BETWEEN :startDate AND :endDate', { startDate, endDate })
            .groupBy('message.model')
            .orderBy('count', 'DESC')
            .getRawMany();

        return result.map(row => ({
            model: row.model,
            usage: parseInt(row.count),
            creditsUsed: parseFloat(row.creditsUsed) || 0,
        }));
    }

    private async getTopUsersByActivity(startDate: Date, endDate: Date, limit: number = 10): Promise<any[]> {
        const result = await this.messageRepository
            .createQueryBuilder('message')
            .innerJoin('message.chat', 'chat')
            .innerJoin('chat.user', 'user')
            .select('user.id', 'userId')
            .addSelect('user.email', 'email')
            .addSelect('COUNT(message.id)', 'messageCount')
            .addSelect('SUM(message.creditsUsed)', 'creditsUsed')
            .where('message.createdAt BETWEEN :startDate AND :endDate', { startDate, endDate })
            .groupBy('user.id, user.email')
            .orderBy('messageCount', 'DESC')
            .limit(limit)
            .getRawMany();

        return result.map(row => ({
            userId: row.userId,
            email: row.email,
            messageCount: parseInt(row.messageCount),
            creditsUsed: parseFloat(row.creditsUsed) || 0,
        }));
    }

    private async getRetentionMetrics(startDate: Date, endDate: Date): Promise<any> {
        // Simple retention calculation - users who were active in both periods
        const previousStart = new Date(startDate.getTime() - (endDate.getTime() - startDate.getTime()));

        const currentActiveUsers = await this.getActiveUserIds(startDate, endDate);
        const previousActiveUsers = await this.getActiveUserIds(previousStart, startDate);

        const retainedUsers = currentActiveUsers.filter(id => previousActiveUsers.includes(id));
        const retentionRate = previousActiveUsers.length > 0
            ? (retainedUsers.length / previousActiveUsers.length) * 100
            : 0;

        return {
            currentActiveUsers: currentActiveUsers.length,
            previousActiveUsers: previousActiveUsers.length,
            retainedUsers: retainedUsers.length,
            retentionRate: parseFloat(retentionRate.toFixed(2)),
        };
    }

    private async getActiveUserIds(startDate: Date, endDate: Date): Promise<string[]> {
        const result = await this.messageRepository
            .createQueryBuilder('message')
            .innerJoin('message.chat', 'chat')
            .select('DISTINCT chat.userId', 'userId')
            .where('message.createdAt BETWEEN :startDate AND :endDate', { startDate, endDate })
            .getRawMany();

        return result.map(row => row.userId);
    }

    private async getCreditsUsedInPeriod(startDate: Date, endDate: Date): Promise<number> {
        const result = await this.transactionRepository
            .createQueryBuilder('transaction')
            .select('SUM(ABS(transaction.amount))', 'total')
            .where('transaction.type = :type', { type: 'USAGE' })
            .andWhere('transaction.createdAt BETWEEN :startDate AND :endDate', { startDate, endDate })
            .getRawOne();

        return parseFloat(result.total) || 0;
    }

    private async getDailyActiveUsersTrend(startDate: Date, endDate: Date): Promise<any[]> {
        const result = await this.messageRepository
            .createQueryBuilder('message')
            .innerJoin('message.chat', 'chat')
            .select('DATE(message.createdAt)', 'date')
            .addSelect('COUNT(DISTINCT chat.userId)', 'activeUsers')
            .where('message.createdAt BETWEEN :startDate AND :endDate', { startDate, endDate })
            .groupBy('DATE(message.createdAt)')
            .orderBy('date', 'ASC')
            .getRawMany();

        return result.map(row => ({
            date: row.date,
            activeUsers: parseInt(row.activeUsers),
        }));
    }

    private async getDailyRevenueTrend(startDate: Date, endDate: Date): Promise<any[]> {
        const result = await this.paymentRepository
            .createQueryBuilder('payment')
            .select('DATE(payment.updatedAt)', 'date')
            .addSelect('SUM(payment.amount)', 'revenue')
            .where('payment.status = :status', { status: 'completed' })
            .andWhere('payment.updatedAt BETWEEN :startDate AND :endDate', { startDate, endDate })
            .groupBy('DATE(payment.updatedAt)')
            .orderBy('date', 'ASC')
            .getRawMany();

        return result.map(row => ({
            date: row.date,
            revenue: parseFloat(row.revenue) || 0,
        }));
    }

    private async getAverageSessionLength(startDate: Date, endDate: Date): Promise<number> {
        // Calculate average time between first and last message in a chat session
        const result = await this.chatRepository
            .createQueryBuilder('chat')
            .leftJoin('chat.messages', 'message')
            .select('AVG(EXTRACT(EPOCH FROM (MAX(message.createdAt) - MIN(message.createdAt))))', 'avgSeconds')
            .where('chat.createdAt BETWEEN :startDate AND :endDate', { startDate, endDate })
            .groupBy('chat.id')
            .having('COUNT(message.id) > 1')
            .getRawOne();

        return parseFloat(result?.avgSeconds) || 0;
    }

    private async getChurnRate(startDate: Date, endDate: Date): Promise<number> {
        // Users who were active before the period but not during
        const periodDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const beforeStart = new Date(startDate.getTime() - periodDays * 24 * 60 * 60 * 1000);

        const activeBeforePeriod = await this.getActiveUserIds(beforeStart, startDate);
        const activeDuringPeriod = await this.getActiveUserIds(startDate, endDate);

        const churnedUsers = activeBeforePeriod.filter(id => !activeDuringPeriod.includes(id));
        const churnRate = activeBeforePeriod.length > 0
            ? (churnedUsers.length / activeBeforePeriod.length) * 100
            : 0;

        return parseFloat(churnRate.toFixed(2));
    }

    private async getLifetimeValue(): Promise<number> {
        const result = await this.paymentRepository
            .createQueryBuilder('payment')
            .innerJoin('payment.user', 'user')
            .select('AVG(user_revenue.total)', 'avgLtv')
            .from(subQuery => {
                return subQuery
                    .select('payment.userId', 'userId')
                    .addSelect('SUM(payment.amount)', 'total')
                    .from('payments', 'payment')
                    .where('payment.status = :status', { status: 'completed' })
                    .groupBy('payment.userId');
            }, 'user_revenue')
            .getRawOne();

        return parseFloat(result?.avgLtv) || 0;
    }
}