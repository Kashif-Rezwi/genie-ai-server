import { Injectable, BadRequestException } from '@nestjs/common';
import { RateLimiterRedis, RateLimiterRes } from 'rate-limiter-flexible';
import { RedisService } from '../../redis/redis.service';
import { getRateLimitConfig } from '../../../config';
import { LoggerService } from '../../../common/services/logger.service';

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

@Injectable()
export class RateLimitService {
    private rateLimiters: Map<string, RateLimiterRedis> = new Map();
    private redisClient: any;

    constructor(
        private readonly redisService: RedisService,
        private readonly logger: LoggerService,
    ) {
        this.redisClient = redisService.getClient();
        this.initializeRateLimiters();
    }

    private initializeRateLimiters() {
        // Simplified rate limiters for 0-1000 users
        this.createRateLimiter('global', {
            keyPrefix: 'global_rate_limit',
            points: 100, // 100 requests
            duration: 60, // per 60 seconds
            blockDuration: 60,
            execEvenly: true,
        });

        this.createRateLimiter('user', {
            keyPrefix: 'user_rate_limit',
            points: 200, // 200 requests
            duration: 60, // per minute
            blockDuration: 60,
        });

        this.createRateLimiter('ai', {
            keyPrefix: 'ai_rate_limit',
            points: 50, // 50 AI requests
            duration: 3600, // per hour
            blockDuration: 300, // 5 minutes block
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
            this.logger.warn('rate-limit', `Redis rate limiting failed for ${limiterName}`, {
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

    async getUserTierFromCredits(userId: string): Promise<'free' | 'paid'> {
        // Simplified tier logic for 0-1000 users
        const balanceKey = `user_balance:${userId}`;
        const balanceStr = await this.redisService.get(balanceKey);

        if (!balanceStr) {
            return 'free';
        }

        const balance = parseFloat(balanceStr);
        return balance > 0 ? 'paid' : 'free';
    }

    async checkUserRateLimit(userId: string, operation: string): Promise<RateLimiterRes> {
        // Simplified rate limiting logic
        switch (operation) {
            case 'api':
                return this.checkRateLimit('user', userId);

            case 'ai':
                return this.checkRateLimit('ai', userId);

            default:
                return this.checkRateLimit('user', userId);
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
