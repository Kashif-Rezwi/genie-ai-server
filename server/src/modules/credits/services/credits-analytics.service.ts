import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, CreditTransaction, TransactionType } from '../../../entities';

export interface CreditAnalytics {
    totalUsers: number;
    activeUsers: number; // Users with > 0 credits
    totalCreditsInCirculation: number;
    totalCreditsEverPurchased: number;
    totalCreditsUsed: number;
    averageCreditsPerUser: number;
    topSpenders: Array<{
        userId: string;
        email: string;
        totalSpent: number;
        totalUsed: number;
        currentBalance: number;
    }>;
    dailyUsage: Array<{
        date: string;
        creditsUsed: number;
        uniqueUsers: number;
    }>;
    modelUsageStats: Array<{
        model: string;
        totalUsage: number;
        uniqueUsers: number;
    }>;
}

export interface UserSpendingPattern {
    userId: string;
    email: string;
    totalPurchases: number;
    totalUsage: number;
    averageSessionCost: number;
    lastActivityDate: Date;
    riskLevel: 'low' | 'medium' | 'high'; // Based on usage patterns
}

@Injectable()
export class CreditsAnalyticsService {
    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        @InjectRepository(CreditTransaction)
        private readonly transactionRepository: Repository<CreditTransaction>,
    ) { }

    async getOverallAnalytics(): Promise<CreditAnalytics> {
        // Get basic user stats
        const totalUsers = await this.userRepository.count();
        const activeUsers = await this.userRepository.count({
            where: { creditsBalance: { $gt: 0 } as any }
        });

        // Calculate total credits in circulation
        const totalCreditsResult = await this.userRepository
            .createQueryBuilder('user')
            .select('SUM(user.creditsBalance)', 'total')
            .getRawOne();
        const totalCreditsInCirculation = parseFloat(totalCreditsResult.total) || 0;

        // Calculate total credits ever purchased
        const purchasesResult = await this.transactionRepository
            .createQueryBuilder('transaction')
            .select('SUM(transaction.amount)', 'total')
            .where('transaction.type = :type', { type: TransactionType.PURCHASE })
            .getRawOne();
        const totalCreditsEverPurchased = parseFloat(purchasesResult.total) || 0;

        // Calculate total credits used
        const usageResult = await this.transactionRepository
            .createQueryBuilder('transaction')
            .select('SUM(ABS(transaction.amount))', 'total')
            .where('transaction.type = :type', { type: TransactionType.USAGE })
            .getRawOne();
        const totalCreditsUsed = parseFloat(usageResult.total) || 0;

        const averageCreditsPerUser = totalUsers > 0 ? totalCreditsInCirculation / totalUsers : 0;

        // Get top spenders
        const topSpenders = await this.getTopSpenders(10);

        // Get daily usage for last 30 days
        const dailyUsage = await this.getDailyUsage(30);

        // Get model usage stats
        const modelUsageStats = await this.getModelUsageStats();

        return {
            totalUsers,
            activeUsers,
            totalCreditsInCirculation,
            totalCreditsEverPurchased,
            totalCreditsUsed,
            averageCreditsPerUser,
            topSpenders,
            dailyUsage,
            modelUsageStats,
        };
    }

    async getTopSpenders(limit: number = 10): Promise<Array<{
        userId: string;
        email: string;
        totalSpent: number;
        totalUsed: number;
        currentBalance: number;
    }>> {
        const result = await this.userRepository
            .createQueryBuilder('user')
            .leftJoin('user.creditTransactions', 'purchase', 'purchase.type = :purchaseType', { purchaseType: TransactionType.PURCHASE })
            .leftJoin('user.creditTransactions', 'usage', 'usage.type = :usageType', { usageType: TransactionType.USAGE })
            .select([
                'user.id as userId',
                'user.email as email',
                'user.creditsBalance as currentBalance',
                'COALESCE(SUM(purchase.amount), 0) as totalSpent',
                'COALESCE(SUM(ABS(usage.amount)), 0) as totalUsed'
            ])
            .groupBy('user.id, user.email, user.creditsBalance')
            .orderBy('totalSpent', 'DESC')
            .limit(limit)
            .getRawMany();

        return result.map(row => ({
            userId: row.userId,
            email: row.email,
            totalSpent: parseFloat(row.totalSpent),
            totalUsed: parseFloat(row.totalUsed),
            currentBalance: parseFloat(row.currentBalance),
        }));
    }

    async getDailyUsage(days: number = 30): Promise<Array<{
        date: string;
        creditsUsed: number;
        uniqueUsers: number;
    }>> {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - days);

        const result = await this.transactionRepository
            .createQueryBuilder('transaction')
            .select([
                'DATE(transaction.createdAt) as date',
                'SUM(ABS(transaction.amount)) as creditsUsed',
                'COUNT(DISTINCT transaction.userId) as uniqueUsers'
            ])
            .where('transaction.type = :type', { type: TransactionType.USAGE })
            .andWhere('transaction.createdAt >= :startDate', { startDate })
            .andWhere('transaction.createdAt <= :endDate', { endDate })
            .groupBy('DATE(transaction.createdAt)')
            .orderBy('date', 'ASC')
            .getRawMany();

        return result.map(row => ({
            date: row.date,
            creditsUsed: parseFloat(row.creditsUsed),
            uniqueUsers: parseInt(row.uniqueUsers),
        }));
    }

    async getModelUsageStats(): Promise<Array<{
        model: string;
        totalUsage: number;
        uniqueUsers: number;
    }>> {
        // Extract model names from transaction descriptions
        const result = await this.transactionRepository
            .createQueryBuilder('transaction')
            .select([
                'transaction.description',
                'SUM(ABS(transaction.amount)) as totalUsage',
                'COUNT(DISTINCT transaction.userId) as uniqueUsers'
            ])
            .where('transaction.type = :type', { type: TransactionType.USAGE })
            .andWhere('transaction.description LIKE :pattern', { pattern: '%(%' })
            .groupBy('transaction.description')
            .orderBy('totalUsage', 'DESC')
            .getRawMany();

        // Parse model names from descriptions
        const modelStats = result.map(row => {
            const description = row.description;
            const modelMatch = description.match(/\(([^)]+)\)/);
            const model = modelMatch ? modelMatch[1] : 'Unknown';

            return {
                model,
                totalUsage: parseFloat(row.totalUsage),
                uniqueUsers: parseInt(row.uniqueUsers),
            };
        });

        // Aggregate by model name
        const aggregated = modelStats.reduce((acc, curr) => {
            const existing = acc.find(item => item.model === curr.model);
            if (existing) {
                existing.totalUsage += curr.totalUsage;
                existing.uniqueUsers += curr.uniqueUsers;
            } else {
                acc.push(curr);
            }
            return acc;
        }, []);

        return aggregated.sort((a, b) => b.totalUsage - a.totalUsage);
    }

    async getUserSpendingPattern(userId: string): Promise<UserSpendingPattern> {
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user) {
            throw new Error('User not found');
        }

        const transactions = await this.transactionRepository.find({
            where: { userId },
            order: { createdAt: 'DESC' },
        });

        const purchases = transactions.filter(t => t.type === TransactionType.PURCHASE);
        const usage = transactions.filter(t => t.type === TransactionType.USAGE);

        const totalPurchases = purchases.reduce((sum, t) => sum + t.amount, 0);
        const totalUsage = Math.abs(usage.reduce((sum, t) => sum + t.amount, 0));
        const averageSessionCost = usage.length > 0 ? totalUsage / usage.length : 0;
        const lastActivityDate = transactions[0]?.createdAt || new Date();

        // Determine risk level based on usage patterns
        let riskLevel: 'low' | 'medium' | 'high' = 'low';
        const balanceRatio = user.creditsBalance / (totalPurchases || 1);

        if (balanceRatio < 0.1) riskLevel = 'high';
        else if (balanceRatio < 0.3) riskLevel = 'medium';

        return {
            userId,
            email: user.email,
            totalPurchases,
            totalUsage,
            averageSessionCost,
            lastActivityDate,
            riskLevel,
        };
    }
}