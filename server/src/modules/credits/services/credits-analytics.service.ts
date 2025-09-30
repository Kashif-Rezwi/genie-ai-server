import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, CreditTransaction, TransactionType } from '../../../entities';
import { CreditsService } from './credits.service';

@Injectable()
export class CreditsAnalyticsService {
    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        @InjectRepository(CreditTransaction)
        private readonly transactionRepository: Repository<CreditTransaction>,
        private readonly creditsService: CreditsService,
    ) {}

    // Keep only these two methods, delete everything else

    async getBasicStats(): Promise<{
        totalUsers: number;
        totalCreditsInCirculation: number;
        totalTransactions: number;
    }> {
        const totalUsers = await this.userRepository.count();
        const creditsResult = await this.userRepository
            .createQueryBuilder('user')
            .select('SUM(user.creditsBalance)', 'total')
            .getRawOne();
        const totalTransactions = await this.transactionRepository.count();

        return {
            totalUsers,
            totalCreditsInCirculation: parseFloat(creditsResult.total) || 0,
            totalTransactions,
        };
    }

    async getUserSummary(userId: string): Promise<{
        balance: number;
        totalPurchased: number;
        totalUsed: number;
        transactionCount: number;
    }> {
        // Use CreditsService for consistent balance retrieval (with caching)
        const balance = await this.creditsService.getBalance(userId);

        const stats = await this.transactionRepository
            .createQueryBuilder('t')
            .select([
                'SUM(CASE WHEN t.type = :purchase THEN t.amount ELSE 0 END) as totalPurchased',
                'SUM(CASE WHEN t.type = :usage THEN ABS(t.amount) ELSE 0 END) as totalUsed',
                'COUNT(*) as transactionCount',
            ])
            .where('t.userId = :userId', { userId })
            .setParameter('purchase', TransactionType.PURCHASE)
            .setParameter('usage', TransactionType.USAGE)
            .getRawOne();

        return {
            balance,
            totalPurchased: parseFloat(stats.totalPurchased) || 0,
            totalUsed: parseFloat(stats.totalUsed) || 0,
            transactionCount: parseInt(stats.transactionCount) || 0,
        };
    }

    // Utility method to invalidate user balance cache
    async invalidateUserCache(userId: string): Promise<void> {
        // This will be handled by CreditsService internally
        // We expose this method for external services that need cache invalidation
        await this.creditsService.getBalance(userId); // This will refresh the cache
    }
}
