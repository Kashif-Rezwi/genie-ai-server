import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  skipSuccessfulRequests?: boolean; // Skip counting successful requests
  skipFailedRequests?: boolean; // Skip counting failed requests
  keyGenerator?: (userId: string, endpoint: string) => string; // Custom key generator
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

export interface UserRateLimitTier {
  tier: 'free' | 'premium' | 'admin';
  limits: {
    [endpoint: string]: RateLimitConfig;
  };
}

/**
 * Per-user rate limiting service
 * Implements user-specific rate limiting with different tiers
 */
@Injectable()
export class PerUserRateLimitService {
  private readonly logger = new Logger(PerUserRateLimitService.name);
  private readonly keyPrefix = 'rate_limit:user:';
  private readonly tierPrefix = 'rate_limit:tier:';

  // Rate limit configurations for different user tiers
  private readonly tierConfigs: Record<string, UserRateLimitTier> = {
    free: {
      tier: 'free',
      limits: {
        'auth:login': { windowMs: 15 * 60 * 1000, maxRequests: 5 }, // 5 attempts per 15 minutes
        'auth:register': { windowMs: 60 * 60 * 1000, maxRequests: 3 }, // 3 attempts per hour
        'ai:chat': { windowMs: 60 * 60 * 1000, maxRequests: 100 }, // 100 requests per hour
        'credits:balance': { windowMs: 60 * 1000, maxRequests: 10 }, // 10 requests per minute
        default: { windowMs: 60 * 60 * 1000, maxRequests: 100 }, // 100 requests per hour
      },
    },
    premium: {
      tier: 'premium',
      limits: {
        'auth:login': { windowMs: 15 * 60 * 1000, maxRequests: 10 }, // 10 attempts per 15 minutes
        'auth:register': { windowMs: 60 * 60 * 1000, maxRequests: 5 }, // 5 attempts per hour
        'ai:chat': { windowMs: 60 * 60 * 1000, maxRequests: 1000 }, // 1000 requests per hour
        'credits:balance': { windowMs: 60 * 1000, maxRequests: 30 }, // 30 requests per minute
        default: { windowMs: 60 * 60 * 1000, maxRequests: 1000 }, // 1000 requests per hour
      },
    },
    admin: {
      tier: 'admin',
      limits: {
        'auth:login': { windowMs: 15 * 60 * 1000, maxRequests: 50 }, // 50 attempts per 15 minutes
        'auth:register': { windowMs: 60 * 60 * 1000, maxRequests: 20 }, // 20 attempts per hour
        'ai:chat': { windowMs: 60 * 60 * 1000, maxRequests: 10000 }, // 10000 requests per hour
        'credits:balance': { windowMs: 60 * 1000, maxRequests: 100 }, // 100 requests per minute
        default: { windowMs: 60 * 60 * 1000, maxRequests: 10000 }, // 10000 requests per hour
      },
    },
  };

  constructor(@InjectRedis() private readonly redis: Redis) {}

  /**
   * Check if user can make a request
   * @param userId - User ID
   * @param endpoint - API endpoint
   * @param userTier - User tier (free, premium, admin)
   * @returns Promise<RateLimitResult> - Rate limit result
   */
  async checkRateLimit(
    userId: string,
    endpoint: string,
    userTier: string = 'free'
  ): Promise<RateLimitResult> {
    try {
      const tierConfig = this.tierConfigs[userTier] || this.tierConfigs.free;
      const config = tierConfig.limits[endpoint] || tierConfig.limits.default;

      const key = this.generateKey(userId, endpoint);
      const now = Date.now();
      const windowStart = now - config.windowMs;

      // Use Redis pipeline for atomic operations
      const pipeline = this.redis.pipeline();

      // Remove expired entries
      pipeline.zremrangebyscore(key, 0, windowStart);

      // Count current requests
      pipeline.zcard(key);

      // Add current request
      pipeline.zadd(key, now, `${now}-${Math.random()}`);

      // Set expiration
      pipeline.expire(key, Math.ceil(config.windowMs / 1000));

      const results = await pipeline.exec();

      if (!results || results.some(result => result[0] !== null)) {
        this.logger.warn(`Rate limit check failed for user ${userId}`);
        return this.createErrorResult(config);
      }

      const currentCount = results[1][1] as number;
      const allowed = currentCount <= config.maxRequests;

      const resetTime = now + config.windowMs;
      const remaining = Math.max(0, config.maxRequests - currentCount);

      if (!allowed) {
        this.logger.warn(`Rate limit exceeded for user ${userId} on endpoint ${endpoint}`);
      }

      return {
        allowed,
        limit: config.maxRequests,
        remaining,
        resetTime,
        retryAfter: allowed ? undefined : Math.ceil((resetTime - now) / 1000),
      };
    } catch (error) {
      this.logger.error(`Rate limit check error for user ${userId}:`, error);
      return this.createErrorResult(this.tierConfigs.free.limits.default);
    }
  }

  /**
   * Get user's rate limit status
   * @param userId - User ID
   * @param endpoint - API endpoint
   * @param userTier - User tier
   * @returns Promise<RateLimitResult> - Current rate limit status
   */
  async getRateLimitStatus(
    userId: string,
    endpoint: string,
    userTier: string = 'free'
  ): Promise<RateLimitResult> {
    try {
      const tierConfig = this.tierConfigs[userTier] || this.tierConfigs.free;
      const config = tierConfig.limits[endpoint] || tierConfig.limits.default;

      const key = this.generateKey(userId, endpoint);
      const now = Date.now();
      const windowStart = now - config.windowMs;

      // Clean up expired entries and count current requests
      const pipeline = this.redis.pipeline();
      pipeline.zremrangebyscore(key, 0, windowStart);
      pipeline.zcard(key);

      const results = await pipeline.exec();

      if (!results || results.some(result => result[0] !== null)) {
        return this.createErrorResult(config);
      }

      const currentCount = results[1][1] as number;
      const allowed = currentCount < config.maxRequests;
      const resetTime = now + config.windowMs;
      const remaining = Math.max(0, config.maxRequests - currentCount);

      return {
        allowed,
        limit: config.maxRequests,
        remaining,
        resetTime,
        retryAfter: allowed ? undefined : Math.ceil((resetTime - now) / 1000),
      };
    } catch (error) {
      this.logger.error(`Rate limit status error for user ${userId}:`, error);
      return this.createErrorResult(this.tierConfigs.free.limits.default);
    }
  }

  /**
   * Reset user's rate limit for an endpoint
   * @param userId - User ID
   * @param endpoint - API endpoint
   * @returns Promise<boolean> - Success status
   */
  async resetRateLimit(userId: string, endpoint: string): Promise<boolean> {
    try {
      const key = this.generateKey(userId, endpoint);
      await this.redis.del(key);

      this.logger.log(`Rate limit reset for user ${userId} on endpoint ${endpoint}`);
      return true;
    } catch (error) {
      this.logger.error(`Rate limit reset error for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Get all user rate limits
   * @param userId - User ID
   * @param userTier - User tier
   * @returns Promise<Record<string, RateLimitResult>> - All rate limits
   */
  async getAllRateLimits(
    userId: string,
    userTier: string = 'free'
  ): Promise<Record<string, RateLimitResult>> {
    try {
      const tierConfig = this.tierConfigs[userTier] || this.tierConfigs.free;
      const results: Record<string, RateLimitResult> = {};

      for (const [endpoint, config] of Object.entries(tierConfig.limits)) {
        results[endpoint] = await this.getRateLimitStatus(userId, endpoint, userTier);
      }

      return results;
    } catch (error) {
      this.logger.error(`Get all rate limits error for user ${userId}:`, error);
      return {};
    }
  }

  /**
   * Update user tier
   * @param userId - User ID
   * @param newTier - New user tier
   * @returns Promise<boolean> - Success status
   */
  async updateUserTier(userId: string, newTier: string): Promise<boolean> {
    try {
      // Clear existing rate limits when tier changes
      const pattern = `${this.keyPrefix}${userId}:*`;
      const keys = await this.redis.keys(pattern);

      if (keys.length > 0) {
        await this.redis.del(...keys);
      }

      // Store new tier
      await this.redis.setex(`${this.tierPrefix}${userId}`, 86400, newTier); // 24 hours

      this.logger.log(`User ${userId} tier updated to ${newTier}`);
      return true;
    } catch (error) {
      this.logger.error(`Update user tier error for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Get user tier
   * @param userId - User ID
   * @returns Promise<string> - User tier
   */
  async getUserTier(userId: string): Promise<string> {
    try {
      const tier = await this.redis.get(`${this.tierPrefix}${userId}`);
      return tier || 'free';
    } catch (error) {
      this.logger.error(`Get user tier error for user ${userId}:`, error);
      return 'free';
    }
  }

  /**
   * Generate rate limit key
   * @param userId - User ID
   * @param endpoint - API endpoint
   * @returns string - Rate limit key
   */
  private generateKey(userId: string, endpoint: string): string {
    return `${this.keyPrefix}${userId}:${endpoint}`;
  }

  /**
   * Create error result
   * @param config - Rate limit configuration
   * @returns RateLimitResult - Error result
   */
  private createErrorResult(config: RateLimitConfig): RateLimitResult {
    return {
      allowed: false,
      limit: config.maxRequests,
      remaining: 0,
      resetTime: Date.now() + config.windowMs,
      retryAfter: Math.ceil(config.windowMs / 1000),
    };
  }
}
