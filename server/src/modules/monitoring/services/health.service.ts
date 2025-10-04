import { Injectable } from '@nestjs/common';
import {
    HealthCheckService,
    HealthCheck,
    HealthCheckResult,
    TypeOrmHealthIndicator,
    MemoryHealthIndicator,
} from '@nestjs/terminus';
import { LoggingService } from './logging.service';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class HealthService {
    constructor(
        private readonly health: HealthCheckService,
        private readonly db: TypeOrmHealthIndicator,
        private readonly memory: MemoryHealthIndicator,
        private readonly loggingService: LoggingService,
        private readonly redisService: RedisService,
    ) {}

    // Removed complex health check - using simplified version for startup scale

    async checkDatabase(): Promise<any> {
        return this.db.pingCheck('database');
    }

    async checkRedis(): Promise<any> {
        try {
            const result = await this.redisService.getClient().ping();
            if (result === 'PONG') {
                return { redis: { status: 'up' } };
            } else {
                throw new Error('Invalid ping response');
            }
        } catch (error) {
            return { redis: { status: 'down', error: error.message } };
        }
    }

    async checkMemory(): Promise<any> {
        // Check if heap used is less than 1GB (reasonable for startup)
        return this.memory.checkHeap('memory_heap', 1024 * 1024 * 1024);
    }

    async getQuickHealthStatus(): Promise<{ status: 'ok' | 'error'; timestamp: Date }> {
        try {
            const [databaseResult, redisResult] = await Promise.allSettled([
                this.checkDatabase(),
                this.checkRedis(),
            ]);

            const hasUnhealthy = [databaseResult, redisResult].some(
                result =>
                    result.status === 'rejected' ||
                    (result.status === 'fulfilled' && result.value.redis?.status === 'down'),
            );

            return {
                status: hasUnhealthy ? 'error' : 'ok',
                timestamp: new Date(),
            };
        } catch (error) {
            this.loggingService.logError('Health check failed', error);
            return {
                status: 'error',
                timestamp: new Date(),
            };
        }
    }
}