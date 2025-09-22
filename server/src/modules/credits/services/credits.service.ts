import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Between } from 'typeorm';
import { User, CreditTransaction, TransactionType } from '../../../entities';
import { getPackageById, calculateTotalCredits } from '../../../config';

export interface CreditOperationResult {
    success: boolean;
    transaction: CreditTransaction;
    newBalance: number;
}

export interface UserCreditSummary {
    userId: string;
    email: string;
    currentBalance: number;
    totalPurchased: number;
    totalUsed: number;
    lastTransactionDate: Date | null;
}

@Injectable()
export class CreditsService {
    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        @InjectRepository(CreditTransaction)
        private readonly transactionRepository: Repository<CreditTransaction>,
        private readonly dataSource: DataSource,
    ) { }

    // Enhanced balance checking with caching potential
    async getUserBalance(userId: string): Promise<number> {
        const user = await this.userRepository.findOne({
            where: { id: userId },
            select: ['id', 'creditsBalance']
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        return user.creditsBalance;
    }

    // Batch credit operations for admin
    async batchAddCredits(operations: Array<{
        userId: string;
        amount: number;
        description: string;
    }>): Promise<CreditOperationResult[]> {
        const results: CreditOperationResult[] = [];

        for (const operation of operations) {
            try {
                const result = await this.addCredits(
                    operation.userId,
                    operation.amount,
                    operation.description
                );
                results.push(result);
            } catch (error) {
                results.push({
                    success: false,
                    transaction: undefined as unknown as CreditTransaction,
                    newBalance: 0,
                });
            }
        }

        return results;
    }

    // Enhanced credit addition with package support
    async addCredits(
        userId: string,
        amount: number,
        description: string,
        razorpayPaymentId?: string,
        packageId?: string
    ): Promise<CreditOperationResult> {
        return this.dataSource.transaction(async (manager) => {
            const user = await manager.findOne(User, {
                where: { id: userId },
                lock: { mode: 'pessimistic_write' }
            });

            if (!user) {
                throw new NotFoundException('User not found');
            }

            let finalAmount = amount;

            // Apply package bonus if specified
            if (packageId) {
                const package_ = getPackageById(packageId);
                if (package_) {
                    finalAmount = calculateTotalCredits(packageId);
                    description = `${description} - ${package_.name} (${package_.bonusPercentage}% bonus)`;
                }
            }

            // Update user balance
            const previousBalance = user.creditsBalance;
            user.creditsBalance += finalAmount;
            await manager.save(user);

            // Create transaction record
            const transaction = manager.create(CreditTransaction, {
                userId,
                type: TransactionType.PURCHASE,
                amount: finalAmount,
                balanceAfter: user.creditsBalance,
                description,
                razorpayPaymentId,
            });

            const savedTransaction = await manager.save(transaction);

            return {
                success: true,
                transaction: savedTransaction,
                newBalance: user.creditsBalance,
            };
        });
    }

    // Enhanced credit deduction with detailed tracking
    async deductCredits(
        userId: string,
        amount: number,
        description: string,
        metadata?: Record<string, any>
    ): Promise<CreditOperationResult> {
        return this.dataSource.transaction(async (manager) => {
            const user = await manager.findOne(User, {
                where: { id: userId },
                lock: { mode: 'pessimistic_write' }
            });

            if (!user) {
                throw new NotFoundException('User not found');
            }

            if (user.creditsBalance < amount) {
                throw new ForbiddenException(`Insufficient credits. Required: ${amount}, Available: ${user.creditsBalance}`);
            }

            // Update user balance
            user.creditsBalance -= amount;
            await manager.save(user);

            // Create transaction record with metadata
            const transaction = manager.create(CreditTransaction, {
                userId,
                type: TransactionType.USAGE,
                amount: -amount,
                balanceAfter: user.creditsBalance,
                description: `${description}${metadata ? ` | ${JSON.stringify(metadata)}` : ''}`,
            });

            const savedTransaction = await manager.save(transaction);

            return {
                success: true,
                transaction: savedTransaction,
                newBalance: user.creditsBalance,
            };
        });
    }

    // Transfer credits between users
    async transferCredits(
        fromUserId: string,
        toUserId: string,
        amount: number,
        description?: string
    ): Promise<{ fromResult: CreditOperationResult; toResult: CreditOperationResult }> {
        return this.dataSource.transaction(async (manager) => {
            // Deduct from sender
            const fromResult = await this.deductCredits(
                fromUserId,
                amount,
                `Transfer to user ${toUserId.substring(0, 8)}... - ${description || 'Credit transfer'}`
            );

            // Add to receiver
            const toResult = await this.addCredits(
                toUserId,
                amount,
                `Transfer from user ${fromUserId.substring(0, 8)}... - ${description || 'Credit transfer'}`
            );

            return { fromResult, toResult };
        });
    }

    // Get detailed transaction history with filters
    async getTransactionHistory(
        userId: string,
        options: {
            limit?: number;
            offset?: number;
            type?: TransactionType;
            startDate?: Date;
            endDate?: Date;
        } = {}
    ): Promise<{ transactions: CreditTransaction[]; total: number }> {
        const { limit = 50, offset = 0, type, startDate, endDate } = options;

        const queryBuilder = this.transactionRepository.createQueryBuilder('transaction')
            .where('transaction.userId = :userId', { userId })
            .orderBy('transaction.createdAt', 'DESC');

        if (type) {
            queryBuilder.andWhere('transaction.type = :type', { type });
        }

        if (startDate && endDate) {
            queryBuilder.andWhere('transaction.createdAt BETWEEN :startDate AND :endDate', {
                startDate,
                endDate,
            });
        }

        const [transactions, total] = await queryBuilder
            .skip(offset)
            .take(limit)
            .getManyAndCount();

        return { transactions, total };
    }

    // Get user credit summary
    async getUserCreditSummary(userId: string): Promise<UserCreditSummary> {
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user) {
            throw new NotFoundException('User not found');
        }

        const transactions = await this.transactionRepository.find({
            where: { userId },
            order: { createdAt: 'DESC' },
        });

        const totalPurchased = transactions
            .filter(t => t.type === TransactionType.PURCHASE)
            .reduce((sum, t) => sum + t.amount, 0);

        const totalUsed = Math.abs(transactions
            .filter(t => t.type === TransactionType.USAGE)
            .reduce((sum, t) => sum + t.amount, 0));

        const lastTransaction = transactions[0] || null;

        return {
            userId: user.id,
            email: user.email,
            currentBalance: user.creditsBalance,
            totalPurchased,
            totalUsed,
            lastTransactionDate: lastTransaction?.createdAt || null,
        };
    }

    // Check if user needs credit top-up alert
    async checkLowCreditAlert(userId: string, threshold: number = 10): Promise<boolean> {
        const balance = await this.getUserBalance(userId);
        return balance <= threshold;
    }
}