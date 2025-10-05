import { Injectable, NotFoundException } from '@nestjs/common';
import { User, CreditTransaction, TransactionType } from '../../../entities';
import { CreditsService } from './credits.service';
import { IUserRepository, ICreditTransactionRepository } from '../../../core/repositories/interfaces';

@Injectable()
export class CreditsAnalyticsService {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly transactionRepository: ICreditTransactionRepository,
    private readonly creditsService: CreditsService
  ) {}

  // Keep only these two methods, delete everything else

  async getBasicStats(): Promise<{
    totalUsers: number;
    totalCreditsInCirculation: number;
    totalTransactions: number;
  }> {
    const [totalUsers, users, totalTransactions] = await Promise.all([
      this.userRepository.count(),
      this.userRepository.findAll(),
      this.transactionRepository.count(),
    ]);

    const totalCreditsInCirculation = users.reduce((sum: number, user: User) => sum + user.creditsBalance, 0);

    return {
      totalUsers,
      totalCreditsInCirculation,
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

    const transactions = await this.transactionRepository.findByUserId(userId);
    
    const totalPurchased = transactions
      .filter(t => t.type === TransactionType.PURCHASE)
      .reduce((sum, t) => sum + t.amount, 0);
    
    const totalUsed = transactions
      .filter(t => t.type === TransactionType.USAGE)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    return {
      balance,
      totalPurchased,
      totalUsed,
      transactionCount: transactions.length,
    };
  }

  // Utility method to invalidate user balance cache
  async invalidateUserCache(userId: string): Promise<void> {
    // This will be handled by CreditsService internally
    // We expose this method for external services that need cache invalidation
    await this.creditsService.getBalance(userId); // This will refresh the cache
  }
}
