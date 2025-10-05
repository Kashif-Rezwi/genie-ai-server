import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { User } from '../../../entities';
import { creditConfig } from '../../../config';
import { IUserRepository } from '../../../core/repositories/interfaces';
import {
  ValidationException,
  ResourceNotFoundException,
  CreditException,
} from '../../../common/exceptions';

/**
 * Service responsible for managing credit balance operations
 * Handles balance retrieval, caching, and basic balance management
 */
@Injectable()
export class CreditBalanceService {
  private readonly logger = new Logger(CreditBalanceService.name);
  private readonly config = creditConfig();

  // Redis resilience
  private redisAvailable: boolean = true;
  private redisLastCheck: Date = new Date();

  constructor(
    private readonly userRepository: IUserRepository,
    @InjectRedis() private readonly redis: Redis,
    private readonly eventEmitter: EventEmitter2
  ) {}

  /**
   * Get user's current credit balance with caching
   * @param userId - The user's ID
   * @returns Promise<number> - The user's credit balance
   * @throws ValidationException - When userId is invalid
   * @throws ResourceNotFoundException - When user is not found
   */
  async getBalance(userId: string): Promise<number> {
    const startTime = Date.now();

    if (!userId || typeof userId !== 'string') {
      this.logger.warn(`Invalid user ID provided to getBalance: ${userId}`);
      throw new ValidationException('Invalid user ID', 'INVALID_USER_ID', {
        providedUserId: userId,
      });
    }

    this.logger.debug(`Getting balance for user ${userId}`);

    // Check if we should retry Redis
    if (!this.redisAvailable) {
      const timeSinceLastCheck = Date.now() - this.redisLastCheck.getTime();
      if (timeSinceLastCheck > this.config.redis.checkInterval) {
        this.redisAvailable = true; // Try Redis again
      }
    }

    if (this.redisAvailable) {
      try {
        const cached = await Promise.race([
          this.redis.get(`${this.config.cache.keyPrefix}${userId}`),
          new Promise<null>((_, reject) =>
            setTimeout(() => reject(new Error('Redis timeout')), this.config.redis.timeout)
          ),
        ]);

        if (cached !== null) {
          const duration = Date.now() - startTime;
          this.logger.debug(`Balance cache hit for user ${userId} (${duration}ms)`);

          // Emit metrics event
          this.eventEmitter.emit('credits.balance.retrieved', {
            userId,
            balance: parseFloat(cached),
            source: 'cache',
            duration,
          });

          return parseFloat(cached);
        }
      } catch (error) {
        this.logger.error('Redis error in getBalance:', error.message);
        this.redisAvailable = false;
        this.redisLastCheck = new Date();
        // Continue to database fallback
      }
    }

    // Database fallback
    const user = await this.userRepository.findById(userId);

    if (!user) {
      this.logger.warn(`User not found: ${userId}`);
      throw new ResourceNotFoundException('User', 'USER_NOT_FOUND', { userId });
    }

    const duration = Date.now() - startTime;
    this.logger.debug(`Balance retrieved from database for user ${userId} (${duration}ms)`);

    // Cache the result
    this.cacheBalance(userId, user.creditsBalance);

    // Emit metrics event
    this.eventEmitter.emit('credits.balance.retrieved', {
      userId,
      balance: user.creditsBalance,
      source: 'database',
      duration,
    });

    return user.creditsBalance;
  }

  /**
   * Update user's credit balance
   * @param userId - The user's ID
   * @param newBalance - The new balance amount
   * @returns Promise<void>
   */
  async updateBalance(userId: string, newBalance: number): Promise<void> {
    if (!userId || typeof userId !== 'string') {
      throw new ValidationException('Invalid user ID', 'INVALID_USER_ID', {
        providedUserId: userId,
      });
    }

    if (typeof newBalance !== 'number' || newBalance < 0) {
      throw new CreditException('Invalid balance amount', 'INVALID_BALANCE_AMOUNT', {
        providedBalance: newBalance,
        expectedType: 'number',
        minimumValue: 0,
      });
    }

    await this.userRepository.update(userId, { creditsBalance: newBalance });

    // Update cache
    this.cacheBalance(userId, newBalance);

    this.logger.debug(`Balance updated for user ${userId}: ${newBalance}`);
  }

  /**
   * Get user's credit status including balance, reserved, and available credits
   * @param userId - The user's ID
   * @returns Promise<object> - User's credit status
   */
  async getUserCreditStatus(userId: string): Promise<{
    balance: number;
    reserved: number;
    available: number;
    status: 'healthy' | 'low' | 'critical' | 'exhausted';
    canUsePaidModels: boolean;
  }> {
    const balance = await this.getBalance(userId);
    const reserved = await this.getReservedCredits(userId);
    const available = Math.max(0, balance - reserved);

    let status: 'healthy' | 'low' | 'critical' | 'exhausted';
    if (available <= 0) {
      status = 'exhausted';
    } else if (available < this.config.business.criticalBalanceThreshold) {
      status = 'critical';
    } else if (available < this.config.business.lowBalanceThreshold) {
      status = 'low';
    } else {
      status = 'healthy';
    }

    return {
      balance,
      reserved,
      available,
      status,
      canUsePaidModels: available >= 1,
    };
  }

  /**
   * Cache user's balance in Redis
   * @param userId - The user's ID
   * @param balance - The balance amount to cache
   * @private
   */
  private async cacheBalance(userId: string, balance: number): Promise<void> {
    if (!this.redisAvailable) return;

    try {
      await this.redis.setex(
        `${this.config.cache.keyPrefix}${userId}`,
        this.config.cache.ttl,
        balance.toString()
      );
    } catch (error) {
      this.logger.warn('Failed to cache balance:', error.message);
    }
  }

  /**
   * Get reserved credits for a user (placeholder implementation)
   * @param userId - The user's ID
   * @returns Promise<number> - Reserved credits amount
   * @private
   */
  private async getReservedCredits(userId: string): Promise<number> {
    // This would typically query a reservations table
    // For MVP, return 0
    return 0;
  }
}
