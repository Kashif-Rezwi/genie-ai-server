import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { User, CreditTransaction, TransactionType, CreditAuditLog } from '../../../entities';
import { TransactionMetadataValidator } from '../interfaces/transaction-metadata.interface';
import { creditConfig } from '../../../config';
import { IUserRepository, ICreditTransactionRepository, ICreditAuditLogRepository } from '../../../core/repositories/interfaces';

/**
 * Service responsible for managing credit transactions
 * Handles credit additions, deductions, and transaction history
 */
@Injectable()
export class CreditTransactionService {
  private readonly logger = new Logger(CreditTransactionService.name);
  private readonly config = creditConfig();

  constructor(
    private readonly userRepository: IUserRepository,
    private readonly transactionRepository: ICreditTransactionRepository,
    private readonly auditRepository: ICreditAuditLogRepository,
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2
  ) {}

  /**
   * Add credits to a user's account
   * @param userId - The user's ID
   * @param amount - The amount of credits to add
   * @param description - Description of the transaction
   * @param metadata - Optional metadata for the transaction
   * @returns Promise<void>
   * @throws BadRequestException - When amount is invalid
   * @throws NotFoundException - When user is not found
   */
  async addCredits(
    userId: string,
    amount: number,
    description: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    this.validateCreditAmount(amount, 'addition');

    await this.dataSource.transaction(async manager => {
      const user = await this.userRepository.findById(userId);

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const balanceBefore = user.creditsBalance;
      user.creditsBalance += amount;
      await this.userRepository.update(userId, user);

      const transaction = await this.transactionRepository.create({
        userId,
        type: TransactionType.PURCHASE,
        amount,
        balanceAfter: user.creditsBalance,
        description,
        metadata: metadata ? TransactionMetadataValidator.validate(metadata) : {},
      });
      // Create audit log
      await this.auditRepository.create({
        userId,
        transactionId: transaction.id,
        action: 'credit_added',
        amount,
        balanceBefore,
        balanceAfter: user.creditsBalance,
        context: {
          description,
        },
      });

      this.logger.log(
        `Credits added: ${amount} to user ${userId}. New balance: ${user.creditsBalance}`
      );

      // Emit event
      this.eventEmitter.emit('credits.added', {
        userId,
        amount,
        newBalance: user.creditsBalance,
        description,
      });
    });
  }

  /**
   * Deduct credits from a user's account
   * @param userId - The user's ID
   * @param amount - The amount of credits to deduct
   * @param description - Description of the transaction
   * @param metadata - Optional metadata for the transaction
   * @returns Promise<void>
   * @throws BadRequestException - When amount is invalid or insufficient credits
   * @throws NotFoundException - When user is not found
   */
  async deductCredits(
    userId: string,
    amount: number,
    description: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    this.validateCreditAmount(amount, 'deduction');

    await this.dataSource.transaction(async manager => {
      const user = await this.userRepository.findById(userId);

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Never allow negative balance
      if (user.creditsBalance < amount) {
        throw new ConflictException(
          `Insufficient credits. Required: ${amount}, Available: ${user.creditsBalance}`
        );
      }

      // Check if this would leave user with critical balance
      const newBalance = user.creditsBalance - amount;
      if (newBalance < this.config.business.criticalBalanceThreshold && newBalance > 0) {
        this.eventEmitter.emit('credits.critical', {
          userId,
          balance: newBalance,
          threshold: this.config.business.criticalBalanceThreshold,
        });
      }

      const balanceBefore = user.creditsBalance;
      user.creditsBalance = newBalance;
      await this.userRepository.update(userId, user);

      const transaction = await this.transactionRepository.create({
        userId,
        type: TransactionType.USAGE,
        amount: -amount,
        balanceAfter: user.creditsBalance,
        description,
        metadata: metadata ? TransactionMetadataValidator.validate(metadata) : {},
      });

      // Create audit log
      await this.auditRepository.create({
        userId,
        transactionId: transaction.id,
        action: 'credit_deducted',
        amount,
        balanceBefore,
        balanceAfter: user.creditsBalance,
        context: {
          description,
        },
      });

      this.logger.log(
        `Credits deducted: ${amount} from user ${userId}. New balance: ${user.creditsBalance}`
      );

      // Emit event
      this.eventEmitter.emit('credits.deducted', {
        userId,
        amount,
        newBalance: user.creditsBalance,
        description,
      });
    });
  }

  /**
   * Get transaction history for a user
   * @param userId - The user's ID
   * @param limit - Maximum number of transactions to return
   * @param offset - Number of transactions to skip
   * @returns Promise<CreditTransaction[]> - Array of transactions
   */
  async getTransactionHistory(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<CreditTransaction[]> {
    if (!userId || typeof userId !== 'string') {
      throw new BadRequestException('Invalid user ID');
    }

    return this.transactionRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  /**
   * Get transaction by ID
   * @param transactionId - The transaction ID
   * @returns Promise<CreditTransaction | null> - The transaction or null if not found
   */
  async getTransactionById(transactionId: string): Promise<CreditTransaction | null> {
    if (!transactionId || typeof transactionId !== 'string') {
      throw new BadRequestException('Invalid transaction ID');
    }

    return this.transactionRepository.findOne({
      where: { id: transactionId },
    });
  }

  /**
   * Validate credit amount
   * @param amount - The amount to validate
   * @param operation - The operation type (addition or deduction)
   * @private
   */
  private validateCreditAmount(amount: number, operation: 'addition' | 'deduction'): void {
    if (typeof amount !== 'number' || !isFinite(amount)) {
      throw new BadRequestException('Amount must be a valid number');
    }

    if (amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }

    if (amount > this.config.business.maximumTransaction) {
      throw new BadRequestException(
        `Amount exceeds maximum allowed: ${this.config.business.maximumTransaction}`
      );
    }

    if (amount < this.config.business.minimumTransaction) {
      throw new BadRequestException(
        `Amount below minimum allowed: ${this.config.business.minimumTransaction}`
      );
    }
  }

  /**
   * Create audit log entry
   * @param manager - Database transaction manager
   * @param auditData - Audit log data
   * @private
   */
  private async createAuditLog(
    manager: any,
    auditData: {
      userId: string;
      transactionId: string;
      action: string;
      details: Record<string, any>;
    }
  ): Promise<void> {
    const auditLog = manager.create(CreditAuditLog, {
      userId: auditData.userId,
      transactionId: auditData.transactionId,
      action: auditData.action,
      details: auditData.details,
      timestamp: new Date(),
    });

    await manager.save(auditLog);
  }
}
