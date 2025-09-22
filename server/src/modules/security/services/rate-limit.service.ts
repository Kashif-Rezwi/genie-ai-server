import { Injectable, BadRequestException } from '@nestjs/common';
import { RateLimiterRedis, RateLimiterRes } from 'rate-limiter-flexible';
import { RedisService } from '../../redis/redis.service';
import { getRateLimitConfig } from '../../../config';

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

    constructor(private readonly redisService: RedisService) {
        this.redisClient = redisService.getClient();
        this.initializeRateLimiters();
    }

    private initializeRateLimiters() {
        // Global API rate limiter
        this.createRateLimiter('global', {
            keyPrefix: 'global_rate_limit',
            points: 1000, // 1000 requests
            duration: 60, // per 60 seconds
            blockDuration: 60,
            execEvenly: true,
        });

        // User tier rate limiters
        this.createRateLimiter('free_user', {
            keyPrefix: 'free_user_rate_limit',
            points: 50, // 50 requests
            duration: 60, // per minute
            blockDuration: 120,
        });

        this.createRateLimiter('basic_user', {
            keyPrefix: 'basic_user_rate_limit',
            points: 200, // 200 requests
            duration: 60, // per minute
            blockDuration: 60,
        });

        this.createRateLimiter('pro_user', {
            keyPrefix: 'pro_user_rate_limit',
            points: 500, // 500 requests
            duration: 60, // per minute
            blockDuration: 30,
        });

        this.createRateLimiter('admin_user', {
            keyPrefix: 'admin_rate_limit',
            points: 2000, // 2000 requests
            duration: 60, // per minute
            blockDuration: 10,
        });

        // AI-specific rate limiters
        this.createRateLimiter('ai_free', {
            keyPrefix: 'ai_free_rate_limit',
            points: 10, // 10 AI requests
            duration: 3600, // per hour
            blockDuration: 1800, // 30 minutes block
        });

        this.createRateLimiter('ai_paid', {
            keyPrefix: 'ai_paid_rate_limit',
            points: 100, // 100 AI requests
            duration: 3600, // per hour
            blockDuration: 300, // 5 minutes block
        });

        // Chat-specific rate limiters
        this.createRateLimiter('chat_creation', {
            keyPrefix: 'chat_creation_rate_limit',
            points: 20, // 20 chat creations
            duration: 3600, // per hour
            blockDuration: 600, // 10 minutes block
        });

        // Payment rate limiter
        this.createRateLimiter('payment', {
            keyPrefix: 'payment_rate_limit',
            points: 5, // 5 payment attempts
            duration: 300, // per 5 minutes
            blockDuration: 900, // 15 minutes block
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
        points: number = 1
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
                    `Rate limit exceeded. Try again in ${timeToReset} seconds`
                );
            }
            throw rateLimitRes;
        }
    }

    async getUserTierFromCredits(userId: string): Promise<'free' | 'basic' | 'pro' | 'admin'> {
        // Check user's credit balance to determine tier
        const balanceKey = `user_balance:${userId}`;
        const balanceStr = await this.redisService.get(balanceKey);

        if (!balanceStr) {
            // Fallback to database or default
            return 'free';
        }

        const balance = parseFloat(balanceStr);

        if (balance >= 1000) return 'pro';
        if (balance >= 100) return 'basic';
        return 'free';
    }

    async checkUserRateLimit(userId: string, operation: string): Promise<RateLimiterRes> {
        const userTier = await this.getUserTierFromCredits(userId);

        // Different operations have different limiters
        switch (operation) {
            case 'api':
                return this.checkRateLimit(`${userTier}_user`, userId);

            case 'ai':
                const aiLimiter = userTier === 'free' ? 'ai_free' : 'ai_paid';
                return this.checkRateLimit(aiLimiter, userId);

            case 'chat':
                return this.checkRateLimit('chat_creation', userId);

            case 'payment':
                return this.checkRateLimit('payment', userId);

            default:
                return this.checkRateLimit('global', userId);
        }
    }

    async getRateLimitStatus(limiterName: string, key: string): Promise<{
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

    async incrementCustomCounter(key: string, increment: number = 1, ttl: number = 3600): Promise<number> {
        const currentValue = await this.redisService.incr(key);

        if (currentValue === 1) {
            // First increment, set TTL
            await this.redisService.expire(key, ttl);
        }

        return currentValue;
    }
}