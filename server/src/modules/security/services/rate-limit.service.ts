import { Injectable, BadRequestException } from '@nestjs/common';
import { RateLimiterRedis, RateLimiterRes } from 'rate-limiter-flexible';
import { RedisService } from '../../redis/redis.service';
import { getRateLimitConfig } from '../../../config';
import { UserTier } from '../../../config/rate-limiting.config';
import { LoggingService } from '../../monitoring/services/logging.service';

export interface RateLimitConfig {
    keyPrefix?: string;
    points: number; // Requests allowed
    duration: number; // Per duration in seconds
    blockDuration?: number; // Block duration in seconds
    execEvenly?: boolean; // Spread requests evenly
}

export interface UserTierLimits {
    free: RateLimitConfig;
    basic: RateLimitConfig;
    pro: RateLimitConfig;
    admin: RateLimitConfig;
}

export interface RateLimitResult {
    allowed: boolean;
    remainingPoints: number;
    msBeforeNext: number;
    totalHits: number;
    tier: UserTier;
}

@Injectable()
export class RateLimitService {
    private rateLimiters: Map<string, RateLimiterRedis> = new Map();
    private redisClient: any;

    constructor(
        private readonly redisService: RedisService,
        private readonly logger: LoggingService,
    ) {
        this.redisClient = redisService.getClient();
        this.initializeRateLimiters();
    }

    private initializeRateLimiters() {
        // Initialize all rate limiters from configuration
        const configs = [
            'global', 'user_free', 'user_basic', 'user_pro', 'user_admin',
            'ai_free', 'ai_basic', 'ai_pro', 'ai_admin',
            'auth', 'password_reset', 'payment', 'upload'
        ];

        configs.forEach(configName => {
            const config = getRateLimitConfig(configName);
            this.createRateLimiter(configName, {
                keyPrefix: `${configName}_rate_limit`,
                ...config,
            });
        });
    }

    private createRateLimiter(name: string, config: RateLimitConfig) {
        const rateLimiter = new RateLimiterRedis({
            storeClient: this.redisClient,
            keyPrefix: config.keyPrefix,
            points: config.points,
            duration: config.duration,
            blockDuration: config.blockDuration || config.duration,
            execEvenly: config.execEvenly || false,
        });

        this.rateLimiters.set(name, rateLimiter);
    }

    async checkRateLimit(
        limiterName: string,
        key: string,
        points: number = 1,
    ): Promise<RateLimiterRes> {
        const rateLimiter = this.rateLimiters.get(limiterName);

        if (!rateLimiter) {
            throw new BadRequestException(`Rate limiter ${limiterName} not found`);
        }

        try {
            return await rateLimiter.consume(key, points);
        } catch (rateLimitRes) {
            if (rateLimitRes instanceof RateLimiterRes) {
                const timeToReset = Math.round(rateLimitRes.msBeforeNext / 1000) || 1;
                throw new BadRequestException(
                    `Rate limit exceeded. Try again in ${timeToReset} seconds`,
                );
            }
            // Redis connection error - allow request but log warning
            this.logger.logWarning(`Redis rate limiting failed for ${limiterName}`, {
                error: rateLimitRes.message,
                limiterName,
            });
            // Return a mock successful response to allow the request
            return {
                totalHits: 1,
                remainingPoints: 999,
                msBeforeNext: 0,
                consumedPoints: 1,
                isFirstInDuration: true,
                toJSON: () => ({}),
            } as unknown as RateLimiterRes;
        }
    }

    async getUserTier(userId: string): Promise<UserTier> {
        try {
            // Check user's credit balance to determine tier
            const balanceKey = `user_balance:${userId}`;
            const balanceStr = await this.redisService.get(balanceKey);

            if (!balanceStr) {
                return UserTier.FREE;
            }

            const balance = parseFloat(balanceStr);
            
            // Tier logic based on credit balance
            if (balance >= 1000) return UserTier.PRO;
            if (balance >= 100) return UserTier.BASIC;
            if (balance > 0) return UserTier.FREE;
            
            return UserTier.FREE;
        } catch (error) {
            this.logger.logWarning('Failed to get user tier, defaulting to free', { userId, error: error.message });
            return UserTier.FREE;
        }
    }

    async checkUserRateLimit(userId: string, operation: string): Promise<RateLimitResult> {
        try {
            const tier = await this.getUserTier(userId);
            const limiterName = this.getLimiterName(operation, tier);
            
            const result = await this.checkRateLimit(limiterName, userId);
            
            return {
                allowed: true,
                remainingPoints: result.remainingPoints,
                msBeforeNext: result.msBeforeNext,
                totalHits: result.consumedPoints,
                tier,
            };
        } catch (error) {
            if (error instanceof BadRequestException) {
                const tier = await this.getUserTier(userId);
                return {
                    allowed: false,
                    remainingPoints: 0,
                    msBeforeNext: 0,
                    totalHits: 0,
                    tier,
                };
            }
            throw error;
        }
    }

    private getLimiterName(operation: string, tier: UserTier): string {
        switch (operation) {
            case 'api':
                return `user_${tier}`;
            case 'ai':
                return `ai_${tier}`;
            case 'auth':
                return 'auth';
            case 'password_reset':
                return 'password_reset';
            case 'payment':
                return 'payment';
            case 'upload':
                return 'upload';
            default:
                return `user_${tier}`;
        }
    }

    async getRateLimitStatus(
        limiterName: string,
        key: string,
    ): Promise<{
        remainingPoints: number;
        msBeforeNext: number;
        totalHits: number;
    }> {
        const rateLimiter = this.rateLimiters.get(limiterName);

        if (!rateLimiter) {
            throw new BadRequestException(`Rate limiter ${limiterName} not found`);
        }

        const res = await rateLimiter.get(key);

        if (!res) {
            const config = this.getConfigForLimiter(limiterName);
            return {
                remainingPoints: config.points,
                msBeforeNext: 0,
                totalHits: 0,
            };
        }

        return {
            remainingPoints: res.remainingPoints || 0,
            msBeforeNext: res.msBeforeNext || 0,
            totalHits: res.consumedPoints || 0,
        };
    }

    private getConfigForLimiter(limiterName: string): RateLimitConfig {
        // Use centralized rate limit configuration
        return getRateLimitConfig(limiterName);
    }

    async resetRateLimit(limiterName: string, key: string): Promise<void> {
        const rateLimiter = this.rateLimiters.get(limiterName);

        if (rateLimiter) {
            await rateLimiter.delete(key);
        }
    }

    async incrementCustomCounter(
        key: string,
        increment: number = 1,
        ttl: number = 3600,
    ): Promise<number> {
        const currentValue = await this.redisService.incr(key);

        if (currentValue === 1) {
            // First increment, set TTL
            await this.redisService.expire(key, ttl);
        }

        return currentValue;
    }
}
