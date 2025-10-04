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

    // Enhanced health check methods
    async getComprehensiveHealthStatus(): Promise<{
        status: 'healthy' | 'degraded' | 'unhealthy';
        timestamp: Date;
        checks: {
            database: { status: 'up' | 'down'; responseTime?: number; error?: string };
            redis: { status: 'up' | 'down'; responseTime?: number; error?: string };
            memory: { status: 'up' | 'down'; usage: number; threshold: number };
            disk: { status: 'up' | 'down'; usage: number; threshold: number };
            cpu: { status: 'up' | 'down'; usage: number; threshold: number };
        };
        summary: {
            totalChecks: number;
            passedChecks: number;
            failedChecks: number;
            overallStatus: string;
        };
    }> {
        const checks: any = {};
        let passedChecks = 0;
        let failedChecks = 0;

        // Database check
        try {
            const dbStart = Date.now();
            const dbResult = await this.checkDatabase();
            const dbResponseTime = Date.now() - dbStart;
            
            checks.database = {
                status: 'up',
                responseTime: dbResponseTime,
            };
            passedChecks++;
        } catch (error) {
            checks.database = {
                status: 'down',
                error: error.message,
            };
            failedChecks++;
        }

        // Redis check
        try {
            const redisStart = Date.now();
            const redisResult = await this.checkRedis();
            const redisResponseTime = Date.now() - redisStart;
            
            checks.redis = {
                status: 'up',
                responseTime: redisResponseTime,
            };
            passedChecks++;
        } catch (error) {
            checks.redis = {
                status: 'down',
                error: error.message,
            };
            failedChecks++;
        }

        // Memory check
        try {
            const memResult = await this.checkMemory();
            const memUsage = process.memoryUsage();
            const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
            const threshold = 1024; // 1GB threshold
            
            checks.memory = {
                status: heapUsedMB < threshold ? 'up' : 'down',
                usage: heapUsedMB,
                threshold,
            };
            
            if (heapUsedMB < threshold) {
                passedChecks++;
            } else {
                failedChecks++;
            }
        } catch (error) {
            checks.memory = {
                status: 'down',
                usage: 0,
                threshold: 1024,
                error: error.message,
            };
            failedChecks++;
        }

        // Disk space check (simplified for MVP)
        try {
            const diskUsage = await this.checkDiskSpace();
            checks.disk = {
                status: diskUsage.usage < diskUsage.threshold ? 'up' : 'down',
                usage: diskUsage.usage,
                threshold: diskUsage.threshold,
            };
            
            if (diskUsage.usage < diskUsage.threshold) {
                passedChecks++;
            } else {
                failedChecks++;
            }
        } catch (error) {
            checks.disk = {
                status: 'down',
                usage: 0,
                threshold: 80,
                error: error.message,
            };
            failedChecks++;
        }

        // CPU usage check (simplified for MVP)
        try {
            const cpuUsage = await this.checkCPUUsage();
            checks.cpu = {
                status: cpuUsage < 80 ? 'up' : 'down',
                usage: cpuUsage,
                threshold: 80,
            };
            
            if (cpuUsage < 80) {
                passedChecks++;
            } else {
                failedChecks++;
            }
        } catch (error) {
            checks.cpu = {
                status: 'down',
                usage: 0,
                threshold: 80,
                error: error.message,
            };
            failedChecks++;
        }

        // Determine overall status
        let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
        if (failedChecks === 0) {
            overallStatus = 'healthy';
        } else if (failedChecks <= 2) {
            overallStatus = 'degraded';
        } else {
            overallStatus = 'unhealthy';
        }

        const totalChecks = passedChecks + failedChecks;

        return {
            status: overallStatus,
            timestamp: new Date(),
            checks,
            summary: {
                totalChecks,
                passedChecks,
                failedChecks,
                overallStatus,
            },
        };
    }

    // Additional health check methods
    private async checkDiskSpace(): Promise<{ usage: number; threshold: number }> {
        // Simplified disk space check for MVP
        // In production, this would use a proper disk monitoring library
        return {
            usage: Math.random() * 100, // Placeholder
            threshold: 80, // 80% threshold
        };
    }

    private async checkCPUUsage(): Promise<number> {
        // Simplified CPU usage check for MVP
        // In production, this would use a proper CPU monitoring library
        return Math.random() * 100; // Placeholder
    }

    // Performance monitoring methods
    async getPerformanceMetrics(): Promise<{
        responseTime: {
            average: number;
            p50: number;
            p95: number;
            p99: number;
        };
        throughput: {
            requestsPerSecond: number;
            requestsPerMinute: number;
        };
        resourceUsage: {
            memory: {
                used: number;
                total: number;
                percentage: number;
            };
            cpu: {
                usage: number;
            };
        };
        uptime: {
            seconds: number;
            formatted: string;
        };
    }> {
        const memUsage = process.memoryUsage();
        const uptime = process.uptime();

        return {
            responseTime: {
                average: 150, // Placeholder - would be calculated from actual metrics
                p50: 120,
                p95: 300,
                p99: 500,
            },
            throughput: {
                requestsPerSecond: 10, // Placeholder
                requestsPerMinute: 600, // Placeholder
            },
            resourceUsage: {
                memory: {
                    used: Math.round(memUsage.heapUsed / 1024 / 1024),
                    total: Math.round(memUsage.heapTotal / 1024 / 1024),
                    percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
                },
                cpu: {
                    usage: Math.random() * 100, // Placeholder
                },
            },
            uptime: {
                seconds: Math.round(uptime),
                formatted: this.formatUptime(uptime),
            },
        };
    }

    private formatUptime(seconds: number): string {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);

        if (days > 0) {
            return `${days}d ${hours}h ${minutes}m ${secs}s`;
        } else if (hours > 0) {
            return `${hours}h ${minutes}m ${secs}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${secs}s`;
        } else {
            return `${secs}s`;
        }
    }
}