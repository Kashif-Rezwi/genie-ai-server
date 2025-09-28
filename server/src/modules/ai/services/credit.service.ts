import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { User, CreditTransaction, TransactionType } from '../../../entities';

@Injectable()
export class CreditService {
    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        @InjectRepository(CreditTransaction)
        private readonly transactionRepository: Repository<CreditTransaction>,
        private readonly dataSource: DataSource,
    ) {}

    async getUserBalance(userId: string): Promise<number> {
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user) {
            throw new BadRequestException('User not found');
        }
        return user.creditsBalance;
    }

    async checkSufficientCredits(userId: string, requiredCredits: number): Promise<boolean> {
        const balance = await this.getUserBalance(userId);
        return balance >= requiredCredits;
    }

    async deductCredits(
        userId: string,
        amount: number,
        description: string,
        model?: string,
    ): Promise<CreditTransaction> {
        return this.dataSource.transaction(async manager => {
            // Lock user row for update to prevent race conditions
            const user = await manager.findOne(User, {
                where: { id: userId },
                lock: { mode: 'pessimistic_write' },
            });

            if (!user) {
                throw new BadRequestException('User not found');
            }

            if (user.creditsBalance < amount) {
                throw new ForbiddenException('Insufficient credits');
            }

            // Update user balance
            user.creditsBalance -= amount;
            await manager.save(user);

            // Create transaction record
            const transaction = manager.create(CreditTransaction, {
                userId,
                type: TransactionType.USAGE,
                amount: -amount, // Negative for deduction
                balanceAfter: user.creditsBalance,
                description: `${description}${model ? ` (${model})` : ''}`,
            });

            return manager.save(transaction);
        });
    }

    async addCredits(
        userId: string,
        amount: number,
        description: string,
        razorpayPaymentId?: string,
    ): Promise<CreditTransaction> {
        return this.dataSource.transaction(async manager => {
            const user = await manager.findOne(User, {
                where: { id: userId },
                lock: { mode: 'pessimistic_write' },
            });

            if (!user) {
                throw new BadRequestException('User not found');
            }

            // Update user balance
            user.creditsBalance += amount;
            await manager.save(user);

            // Create transaction record
            const transaction = manager.create(CreditTransaction, {
                userId,
                type: TransactionType.PURCHASE,
                amount,
                balanceAfter: user.creditsBalance,
                description,
                razorpayPaymentId,
            });

            return manager.save(transaction);
        });
    }

    async getTransactionHistory(userId: string, limit: number = 50): Promise<CreditTransaction[]> {
        return this.transactionRepository.find({
            where: { userId },
            order: { createdAt: 'DESC' },
            take: limit,
        });
    }
}
