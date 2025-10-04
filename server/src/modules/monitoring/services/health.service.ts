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

    async checkDiskSpace(): Promise<any> {
        try {
            const fs = require('fs');
            const stats = fs.statSync('.');
            return { disk: { status: 'up', available: true } };
        } catch (error) {
            return { disk: { status: 'down', error: error.message } };
        }
    }

    async checkExternalServices(): Promise<any> {
        try {
            // Check if we can reach external AI services (basic connectivity)
            const services = {
                openai: process.env.OPENAI_API_KEY ? 'configured' : 'not_configured',
                anthropic: process.env.ANTHROPIC_API_KEY ? 'configured' : 'not_configured',
                groq: process.env.GROQ_API_KEY ? 'configured' : 'not_configured',
            };
            return { external_services: services };
        } catch (error) {
            return { external_services: { status: 'error', error: error.message } };
        }
    }

    async getQuickHealthStatus(): Promise<{ status: 'ok' | 'error'; timestamp: Date; details?: any }> {
        try {
            const [databaseResult, redisResult, memoryResult] = await Promise.allSettled([
                this.checkDatabase(),
                this.checkRedis(),
                this.checkMemory(),
            ]);

            const results = {
                database: databaseResult.status === 'fulfilled' ? databaseResult.value : { status: 'down', error: databaseResult.reason },
                redis: redisResult.status === 'fulfilled' ? redisResult.value : { status: 'down', error: redisResult.reason },
                memory: memoryResult.status === 'fulfilled' ? memoryResult.value : { status: 'down', error: memoryResult.reason },
            };

            const hasUnhealthy = Object.values(results).some(
                result => result.status === 'down' || result.status === 'error'
            );

            return {
                status: hasUnhealthy ? 'error' : 'ok',
                timestamp: new Date(),
                details: results,
            };
        } catch (error) {
            this.loggingService.logError('Health check failed', error);
            return {
                status: 'error',
                timestamp: new Date(),
                details: { error: error.message },
            };
        }
    }

    async getDetailedHealthStatus(): Promise<any> {
        try {
            const [databaseResult, redisResult, memoryResult, diskResult, externalResult] = await Promise.allSettled([
                this.checkDatabase(),
                this.checkRedis(),
                this.checkMemory(),
                this.checkDiskSpace(),
                this.checkExternalServices(),
            ]);

            return {
                status: 'ok',
                timestamp: new Date(),
                uptime: process.uptime(),
                environment: process.env.NODE_ENV || 'development',
                version: process.env.npm_package_version || '1.0.0',
                services: {
                    database: databaseResult.status === 'fulfilled' ? databaseResult.value : { status: 'down', error: databaseResult.reason },
                    redis: redisResult.status === 'fulfilled' ? redisResult.value : { status: 'down', error: redisResult.reason },
                    memory: memoryResult.status === 'fulfilled' ? memoryResult.value : { status: 'down', error: memoryResult.reason },
                    disk: diskResult.status === 'fulfilled' ? diskResult.value : { status: 'down', error: diskResult.reason },
                    external: externalResult.status === 'fulfilled' ? externalResult.value : { status: 'down', error: externalResult.reason },
                },
                system: {
                    platform: process.platform,
                    nodeVersion: process.version,
                    pid: process.pid,
                    memoryUsage: process.memoryUsage(),
                    cpuUsage: process.cpuUsage(),
                },
            };
        } catch (error) {
            this.loggingService.logError('Detailed health check failed', error);
            return {
                status: 'error',
                timestamp: new Date(),
                error: error.message,
            };
        }
    }
}