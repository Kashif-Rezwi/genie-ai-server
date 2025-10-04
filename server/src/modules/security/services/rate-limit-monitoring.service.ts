import { Injectable } from '@nestjs/common';
import { RateLimitService } from './rate-limit.service';
import { RedisService } from '../../redis/redis.service';
import { LoggingService } from '../../monitoring/services/logging.service';
import { UserTier } from '../../../config/rate-limiting.config';

export interface RateLimitStats {
    totalRequests: number;
    blockedRequests: number;
    averageResponseTime: number;
    topEndpoints: Array<{ endpoint: string; requests: number }>;
    tierDistribution: Record<UserTier, number>;
}

export interface RateLimitAlert {
    type: 'high_usage' | 'abuse_detected' | 'system_overload';
    message: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    timestamp: Date;
    data: Record<string, any>;
}

@Injectable()
export class RateLimitMonitoringService {
    constructor(
        private readonly rateLimitService: RateLimitService,
        private readonly redisService: RedisService,
        private readonly loggingService: LoggingService,
    ) {}

    async getRateLimitStats(timeWindow: number = 3600): Promise<RateLimitStats> {
        try {
            const stats = await this.redisService.get(`rate_limit_stats:${timeWindow}`);
            
            if (stats) {
                return JSON.parse(stats);
            }

            // Calculate stats from Redis data
            const totalRequests = await this.getTotalRequests(timeWindow);
            const blockedRequests = await this.getBlockedRequests(timeWindow);
            const averageResponseTime = await this.getAverageResponseTime(timeWindow);
            const topEndpoints = await this.getTopEndpoints(timeWindow);
            const tierDistribution = await this.getTierDistribution(timeWindow);

            const result: RateLimitStats = {
                totalRequests,
                blockedRequests,
                averageResponseTime,
                topEndpoints,
                tierDistribution,
            };

            // Cache the result for 5 minutes
            await this.redisService.set(`rate_limit_stats:${timeWindow}`, JSON.stringify(result), 300);

            return result;
        } catch (error) {
            this.loggingService.logError('Failed to get rate limit stats', error);
            return {
                totalRequests: 0,
                blockedRequests: 0,
                averageResponseTime: 0,
                topEndpoints: [],
                tierDistribution: {
                    [UserTier.FREE]: 0,
                    [UserTier.BASIC]: 0,
                    [UserTier.PRO]: 0,
                    [UserTier.ADMIN]: 0,
                },
            };
        }
    }

    async checkForAlerts(): Promise<RateLimitAlert[]> {
        const alerts: RateLimitAlert[] = [];

        try {
            // Check for high usage patterns
            const highUsageAlert = await this.checkHighUsage();
            if (highUsageAlert) alerts.push(highUsageAlert);

            // Check for abuse patterns
            const abuseAlert = await this.checkAbusePatterns();
            if (abuseAlert) alerts.push(abuseAlert);

            // Check for system overload
            const overloadAlert = await this.checkSystemOverload();
            if (overloadAlert) alerts.push(overloadAlert);

            return alerts;
        } catch (error) {
            this.loggingService.logError('Failed to check rate limit alerts', error);
            return [];
        }
    }

    async recordRequest(
        userId: string | null,
        endpoint: string,
        method: string,
        responseTime: number,
        wasBlocked: boolean,
    ): Promise<void> {
        try {
            const timestamp = Date.now();
            const key = `request:${timestamp}:${Math.random()}`;
            
            const requestData = {
                userId,
                endpoint,
                method,
                responseTime,
                wasBlocked,
                timestamp,
            };

            // Store request data
            await this.redisService.set(key, JSON.stringify(requestData), 3600);

            // Update counters
            await this.redisService.incr('total_requests');
            if (wasBlocked) {
                await this.redisService.incr('blocked_requests');
            }

            // Update endpoint counter
            await this.redisService.incr(`endpoint:${endpoint}:${method}`);

            // Update user tier counter if authenticated
            if (userId) {
                const tier = await this.rateLimitService.getUserTier(userId);
                await this.redisService.incr(`tier:${tier}`);
            }
        } catch (error) {
            this.loggingService.logError('Failed to record request', error);
        }
    }

    private async getTotalRequests(timeWindow: number): Promise<number> {
        const count = await this.redisService.get('total_requests');
        return parseInt(count || '0', 10);
    }

    private async getBlockedRequests(timeWindow: number): Promise<number> {
        const count = await this.redisService.get('blocked_requests');
        return parseInt(count || '0', 10);
    }

    private async getAverageResponseTime(timeWindow: number): Promise<number> {
        // This would require more complex Redis operations
        // For MVP, return a placeholder
        return 150; // 150ms average
    }

    private async getTopEndpoints(timeWindow: number): Promise<Array<{ endpoint: string; requests: number }>> {
        // This would require scanning Redis keys
        // For MVP, return placeholder data
        return [
            { endpoint: '/api/ai/generate', requests: 100 },
            { endpoint: '/api/auth/login', requests: 50 },
            { endpoint: '/api/chat/message', requests: 75 },
        ];
    }

    private async getTierDistribution(timeWindow: number): Promise<Record<UserTier, number>> {
        const distribution: Record<UserTier, number> = {
            [UserTier.FREE]: 0,
            [UserTier.BASIC]: 0,
            [UserTier.PRO]: 0,
            [UserTier.ADMIN]: 0,
        };

        for (const tier of Object.values(UserTier)) {
            const count = await this.redisService.get(`tier:${tier}`);
            distribution[tier as UserTier] = parseInt(count || '0', 10);
        }

        return distribution;
    }

    private async checkHighUsage(): Promise<RateLimitAlert | null> {
        const totalRequests = await this.getTotalRequests(3600);
        
        if (totalRequests > 10000) { // More than 10k requests per hour
            return {
                type: 'high_usage',
                message: `High usage detected: ${totalRequests} requests in the last hour`,
                severity: 'medium',
                timestamp: new Date(),
                data: { totalRequests, timeWindow: 3600 },
            };
        }

        return null;
    }

    private async checkAbusePatterns(): Promise<RateLimitAlert | null> {
        const blockedRequests = await this.getBlockedRequests(3600);
        const totalRequests = await this.getTotalRequests(3600);
        
        const blockRate = totalRequests > 0 ? (blockedRequests / totalRequests) * 100 : 0;
        
        if (blockRate > 20) { // More than 20% block rate
            return {
                type: 'abuse_detected',
                message: `High block rate detected: ${blockRate.toFixed(2)}% of requests blocked`,
                severity: 'high',
                timestamp: new Date(),
                data: { blockRate, blockedRequests, totalRequests },
            };
        }

        return null;
    }

    private async checkSystemOverload(): Promise<RateLimitAlert | null> {
        // Check if Redis is responding slowly
        const start = Date.now();
        await this.redisService.get('ping_test');
        const responseTime = Date.now() - start;
        
        if (responseTime > 1000) { // Redis taking more than 1 second
            return {
                type: 'system_overload',
                message: `Redis response time is high: ${responseTime}ms`,
                severity: 'critical',
                timestamp: new Date(),
                data: { responseTime },
            };
        }

        return null;
    }

    async resetStats(): Promise<void> {
        try {
            await this.redisService.del('total_requests');
            await this.redisService.del('blocked_requests');
            
            // Reset tier counters
            for (const tier of Object.values(UserTier)) {
                await this.redisService.del(`tier:${tier}`);
            }

            this.loggingService.logInfo('Rate limit stats reset');
        } catch (error) {
            this.loggingService.logError('Failed to reset rate limit stats', error);
        }
    }
}
