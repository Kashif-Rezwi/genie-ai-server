import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';

export interface BruteForceConfig {
  maxAttempts: number; // Maximum failed attempts
  windowMs: number; // Time window in milliseconds
  blockDurationMs: number; // Block duration in milliseconds
  progressiveDelay: boolean; // Enable progressive delay
  maxDelayMs: number; // Maximum delay in milliseconds
}

export interface BruteForceResult {
  allowed: boolean;
  attemptsRemaining: number;
  blockExpiresAt?: number;
  nextAttemptDelay?: number;
  isBlocked: boolean;
}

export interface BruteForceStats {
  totalAttempts: number;
  failedAttempts: number;
  successfulAttempts: number;
  blocksTriggered: number;
  lastAttemptAt: number;
  isCurrentlyBlocked: boolean;
}

/**
 * Brute force protection service
 * Implements progressive delays and account blocking
 */
@Injectable()
export class BruteForceProtectionService {
  private readonly logger = new Logger(BruteForceProtectionService.name);
  private readonly keyPrefix = 'brute_force:';
  private readonly blockPrefix = 'brute_force_block:';
  private readonly statsPrefix = 'brute_force_stats:';

  // Brute force protection configurations
  private readonly configs: Record<string, BruteForceConfig> = {
    login: {
      maxAttempts: 5,
      windowMs: 15 * 60 * 1000, // 15 minutes
      blockDurationMs: 30 * 60 * 1000, // 30 minutes
      progressiveDelay: true,
      maxDelayMs: 60 * 1000, // 1 minute
    },
    register: {
      maxAttempts: 3,
      windowMs: 60 * 60 * 1000, // 1 hour
      blockDurationMs: 2 * 60 * 60 * 1000, // 2 hours
      progressiveDelay: true,
      maxDelayMs: 30 * 1000, // 30 seconds
    },
    password_reset: {
      maxAttempts: 3,
      windowMs: 60 * 60 * 1000, // 1 hour
      blockDurationMs: 4 * 60 * 60 * 1000, // 4 hours
      progressiveDelay: true,
      maxDelayMs: 60 * 1000, // 1 minute
    },
    api_key: {
      maxAttempts: 10,
      windowMs: 60 * 60 * 1000, // 1 hour
      blockDurationMs: 24 * 60 * 60 * 1000, // 24 hours
      progressiveDelay: true,
      maxDelayMs: 5 * 60 * 1000, // 5 minutes
    },
  };

  constructor(@InjectRedis() private readonly redis: Redis) {}

  /**
   * Check if action is allowed (not blocked by brute force protection)
   * @param identifier - User identifier (email, IP, etc.)
   * @param action - Action type (login, register, etc.)
   * @returns Promise<BruteForceResult> - Brute force check result
   */
  async checkBruteForce(identifier: string, action: string = 'login'): Promise<BruteForceResult> {
    try {
      const config = this.configs[action] || this.configs.login;
      const key = this.generateKey(identifier, action);
      const blockKey = this.generateBlockKey(identifier, action);
      const now = Date.now();

      // Check if currently blocked
      const blockExpiresAt = await this.redis.get(blockKey);
      if (blockExpiresAt && parseInt(blockExpiresAt) > now) {
        return {
          allowed: false,
          attemptsRemaining: 0,
          blockExpiresAt: parseInt(blockExpiresAt),
          isBlocked: true,
        };
      }

      // Get current attempt count
      const attempts = await this.redis.get(key);
      const attemptCount = attempts ? parseInt(attempts) : 0;

      if (attemptCount >= config.maxAttempts) {
        // Trigger block
        await this.triggerBlock(identifier, action, config);
        return {
          allowed: false,
          attemptsRemaining: 0,
          blockExpiresAt: now + config.blockDurationMs,
          isBlocked: true,
        };
      }

      // Calculate progressive delay
      let nextAttemptDelay = 0;
      if (config.progressiveDelay && attemptCount > 0) {
        nextAttemptDelay = Math.min(
          attemptCount * 2000, // 2 seconds per attempt
          config.maxDelayMs
        );
      }

      return {
        allowed: true,
        attemptsRemaining: config.maxAttempts - attemptCount,
        nextAttemptDelay,
        isBlocked: false,
      };
    } catch (error) {
      this.logger.error(`Brute force check error for ${identifier}:`, error);
      return {
        allowed: false,
        attemptsRemaining: 0,
        isBlocked: true,
      };
    }
  }

  /**
   * Record a failed attempt
   * @param identifier - User identifier
   * @param action - Action type
   * @returns Promise<BruteForceResult> - Updated brute force status
   */
  async recordFailedAttempt(
    identifier: string,
    action: string = 'login'
  ): Promise<BruteForceResult> {
    try {
      const config = this.configs[action] || this.configs.login;
      const key = this.generateKey(identifier, action);
      const now = Date.now();

      // Increment attempt count
      const pipeline = this.redis.pipeline();
      pipeline.incr(key);
      pipeline.expire(key, Math.ceil(config.windowMs / 1000));

      await pipeline.exec();

      // Update stats
      await this.updateStats(identifier, action, 'failed');

      // Check if this triggers a block
      const attempts = await this.redis.get(key);
      const attemptCount = attempts ? parseInt(attempts) : 0;

      if (attemptCount >= config.maxAttempts) {
        await this.triggerBlock(identifier, action, config);
        return {
          allowed: false,
          attemptsRemaining: 0,
          blockExpiresAt: now + config.blockDurationMs,
          isBlocked: true,
        };
      }

      // Calculate progressive delay
      let nextAttemptDelay = 0;
      if (config.progressiveDelay && attemptCount > 0) {
        nextAttemptDelay = Math.min(
          attemptCount * 2000, // 2 seconds per attempt
          config.maxDelayMs
        );
      }

      this.logger.warn(
        `Failed attempt recorded for ${identifier} (${action}): ${attemptCount}/${config.maxAttempts}`
      );

      return {
        allowed: true,
        attemptsRemaining: config.maxAttempts - attemptCount,
        nextAttemptDelay,
        isBlocked: false,
      };
    } catch (error) {
      this.logger.error(`Record failed attempt error for ${identifier}:`, error);
      return {
        allowed: false,
        attemptsRemaining: 0,
        isBlocked: true,
      };
    }
  }

  /**
   * Record a successful attempt and reset counter
   * @param identifier - User identifier
   * @param action - Action type
   * @returns Promise<boolean> - Success status
   */
  async recordSuccessfulAttempt(identifier: string, action: string = 'login'): Promise<boolean> {
    try {
      const key = this.generateKey(identifier, action);
      const blockKey = this.generateBlockKey(identifier, action);

      // Clear attempt counter and block
      const pipeline = this.redis.pipeline();
      pipeline.del(key);
      pipeline.del(blockKey);

      await pipeline.exec();

      // Update stats
      await this.updateStats(identifier, action, 'successful');

      this.logger.log(`Successful attempt recorded for ${identifier} (${action}) - counters reset`);
      return true;
    } catch (error) {
      this.logger.error(`Record successful attempt error for ${identifier}:`, error);
      return false;
    }
  }

  /**
   * Get brute force statistics
   * @param identifier - User identifier
   * @param action - Action type
   * @returns Promise<BruteForceStats> - Brute force statistics
   */
  async getBruteForceStats(identifier: string, action: string = 'login'): Promise<BruteForceStats> {
    try {
      const statsKey = this.generateStatsKey(identifier, action);
      const blockKey = this.generateBlockKey(identifier, action);
      const key = this.generateKey(identifier, action);

      const pipeline = this.redis.pipeline();
      pipeline.hgetall(statsKey);
      pipeline.get(blockKey);
      pipeline.get(key);

      const results = await pipeline.exec();

      if (!results || results.some(result => result[0] !== null)) {
        return this.getDefaultStats();
      }

      const stats = results[0][1] as Record<string, string>;
      const blockExpiresAt = results[1][1] as string;
      const currentAttempts = results[2][1] as string;

      const now = Date.now();
      const isCurrentlyBlocked = !!(blockExpiresAt && parseInt(blockExpiresAt) > now);

      return {
        totalAttempts: parseInt(stats.totalAttempts || '0'),
        failedAttempts: parseInt(stats.failedAttempts || '0'),
        successfulAttempts: parseInt(stats.successfulAttempts || '0'),
        blocksTriggered: parseInt(stats.blocksTriggered || '0'),
        lastAttemptAt: parseInt(stats.lastAttemptAt || '0'),
        isCurrentlyBlocked,
      };
    } catch (error) {
      this.logger.error(`Get brute force stats error for ${identifier}:`, error);
      return this.getDefaultStats();
    }
  }

  /**
   * Reset brute force protection for identifier
   * @param identifier - User identifier
   * @param action - Action type
   * @returns Promise<boolean> - Success status
   */
  async resetBruteForceProtection(identifier: string, action: string = 'login'): Promise<boolean> {
    try {
      const key = this.generateKey(identifier, action);
      const blockKey = this.generateBlockKey(identifier, action);
      const statsKey = this.generateStatsKey(identifier, action);

      const pipeline = this.redis.pipeline();
      pipeline.del(key);
      pipeline.del(blockKey);
      pipeline.del(statsKey);

      await pipeline.exec();

      this.logger.log(`Brute force protection reset for ${identifier} (${action})`);
      return true;
    } catch (error) {
      this.logger.error(`Reset brute force protection error for ${identifier}:`, error);
      return false;
    }
  }

  /**
   * Trigger account block
   * @param identifier - User identifier
   * @param action - Action type
   * @param config - Brute force configuration
   * @returns Promise<void>
   */
  private async triggerBlock(
    identifier: string,
    action: string,
    config: BruteForceConfig
  ): Promise<void> {
    try {
      const blockKey = this.generateBlockKey(identifier, action);
      const blockExpiresAt = Date.now() + config.blockDurationMs;

      await this.redis.setex(
        blockKey,
        Math.ceil(config.blockDurationMs / 1000),
        blockExpiresAt.toString()
      );

      // Update stats
      await this.updateStats(identifier, action, 'block');

      this.logger.warn(
        `Account blocked for ${identifier} (${action}) until ${new Date(blockExpiresAt).toISOString()}`
      );
    } catch (error) {
      this.logger.error(`Trigger block error for ${identifier}:`, error);
    }
  }

  /**
   * Update brute force statistics
   * @param identifier - User identifier
   * @param action - Action type
   * @param type - Event type (failed, successful, block)
   * @returns Promise<void>
   */
  private async updateStats(
    identifier: string,
    action: string,
    type: 'failed' | 'successful' | 'block'
  ): Promise<void> {
    try {
      const statsKey = this.generateStatsKey(identifier, action);
      const now = Date.now();

      const pipeline = this.redis.pipeline();
      pipeline.hincrby(statsKey, 'totalAttempts', 1);
      pipeline.hset(statsKey, 'lastAttemptAt', now);

      if (type === 'failed') {
        pipeline.hincrby(statsKey, 'failedAttempts', 1);
      } else if (type === 'successful') {
        pipeline.hincrby(statsKey, 'successfulAttempts', 1);
      } else if (type === 'block') {
        pipeline.hincrby(statsKey, 'blocksTriggered', 1);
      }

      // Set expiration (24 hours)
      pipeline.expire(statsKey, 86400);

      await pipeline.exec();
    } catch (error) {
      this.logger.error(`Update stats error for ${identifier}:`, error);
    }
  }

  /**
   * Generate brute force key
   * @param identifier - User identifier
   * @param action - Action type
   * @returns string - Brute force key
   */
  private generateKey(identifier: string, action: string): string {
    return `${this.keyPrefix}${action}:${identifier}`;
  }

  /**
   * Generate block key
   * @param identifier - User identifier
   * @param action - Action type
   * @returns string - Block key
   */
  private generateBlockKey(identifier: string, action: string): string {
    return `${this.blockPrefix}${action}:${identifier}`;
  }

  /**
   * Generate stats key
   * @param identifier - User identifier
   * @param action - Action type
   * @returns string - Stats key
   */
  private generateStatsKey(identifier: string, action: string): string {
    return `${this.statsPrefix}${action}:${identifier}`;
  }

  /**
   * Get default stats
   * @returns BruteForceStats - Default statistics
   */
  private getDefaultStats(): BruteForceStats {
    return {
      totalAttempts: 0,
      failedAttempts: 0,
      successfulAttempts: 0,
      blocksTriggered: 0,
      lastAttemptAt: 0,
      isCurrentlyBlocked: false,
    };
  }
}
