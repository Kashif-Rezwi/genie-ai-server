import { Injectable, OnModuleDestroy } from '@nestjs/common';
import {
    HealthCheckService,
    HealthCheck,
    HealthCheckResult,
    HealthIndicatorResult,
    TypeOrmHealthIndicator,
    MemoryHealthIndicator,
    DiskHealthIndicator,
} from '@nestjs/terminus';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LoggingService, LogContext } from './logging.service';
import { RedisService } from '../../redis/redis.service';
import { User } from '../../../entities';
import { appConfig, emailConfig, redisConfig, monitoringConfig } from '../../../config';

export interface HealthStatus {
    status: 'ok' | 'error';
    timestamp: Date;
    uptime: number;
    version: string;
    environment: string;
    services: {
        database: ServiceHealth;
        redis: ServiceHealth;
        email: ServiceHealth;
        queues: ServiceHealth;
        filesystem: ServiceHealth;
        memory: ServiceHealth;
    };
    metrics: {
        totalUsers: number;
        activeConnections: number;
        queueJobs: {
            active: number;
            waiting: number;
            failed: number;
        };
    };
}

export interface ServiceHealth {
    status: 'healthy' | 'unhealthy' | 'degraded';
    responseTime?: number;
    lastChecked: Date;
    error?: string;
    details?: Record<string, any>;
}

@Injectable()
export class HealthService implements OnModuleDestroy {
    private readonly appConfig = appConfig();
    private readonly emailConfig = emailConfig();
    private readonly redisConfig = redisConfig();
    private readonly monitoringConfig = monitoringConfig();

    private lastHealthCheck: HealthStatus | null = null;
    private healthCheckInterval: NodeJS.Timeout | null = null;

    constructor(
        private readonly health: HealthCheckService,
        private readonly db: TypeOrmHealthIndicator,
        private readonly memory: MemoryHealthIndicator,
        private readonly disk: DiskHealthIndicator,
        private readonly loggingService: LoggingService,
        private readonly redisService: RedisService,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
    ) {
        this.startHealthMonitoring();
    }

    @HealthCheck()
    async checkOverallHealth(): Promise<HealthCheckResult> {
        return this.health.check([
            () => this.checkDatabase(),
            () => this.checkRedis(),
            () => this.checkMemory(),
            () => this.checkDisk(),
        ]);
    }

    async getDetailedHealth(): Promise<HealthStatus> {
        const startTime = Date.now();

        try {
            // Use Promise.allSettled to prevent one failing service from breaking the entire health check
            const [
                databaseResult,
                redisResult,
                emailResult,
                queueResult,
                filesystemResult,
                memoryResult,
                metricsResult,
            ] = await Promise.allSettled([
                this.checkDatabaseHealth(),
                this.checkRedisHealth(),
                this.checkEmailHealth(),
                this.checkQueueHealth(),
                this.checkFilesystemHealth(),
                this.checkMemoryHealth(),
                this.getHealthMetrics(),
            ]);

            const databaseHealth =
                databaseResult.status === 'fulfilled'
                    ? databaseResult.value
                    : {
                          status: 'unhealthy' as const,
                          lastChecked: new Date(),
                          error: databaseResult.reason?.message || 'Database check failed',
                      };

            const redisHealth =
                redisResult.status === 'fulfilled'
                    ? redisResult.value
                    : {
                          status: 'unhealthy' as const,
                          lastChecked: new Date(),
                          error: redisResult.reason?.message || 'Redis check failed',
                      };

            const emailHealth =
                emailResult.status === 'fulfilled'
                    ? emailResult.value
                    : {
                          status: 'unhealthy' as const,
                          lastChecked: new Date(),
                          error: emailResult.reason?.message || 'Email check failed',
                      };

            const queueHealth =
                queueResult.status === 'fulfilled'
                    ? queueResult.value
                    : {
                          status: 'unhealthy' as const,
                          lastChecked: new Date(),
                          error: queueResult.reason?.message || 'Queue check failed',
                      };

            const filesystemHealth =
                filesystemResult.status === 'fulfilled'
                    ? filesystemResult.value
                    : {
                          status: 'unhealthy' as const,
                          lastChecked: new Date(),
                          error: filesystemResult.reason?.message || 'Filesystem check failed',
                      };

            const memoryHealth =
                memoryResult.status === 'fulfilled'
                    ? memoryResult.value
                    : {
                          status: 'unhealthy' as const,
                          lastChecked: new Date(),
                          error: memoryResult.reason?.message || 'Memory check failed',
                      };

            const metrics =
                metricsResult.status === 'fulfilled'
                    ? metricsResult.value
                    : {
                          totalUsers: 0,
                          activeConnections: 0,
                          queueJobs: { active: 0, waiting: 0, failed: 0 },
                      };

            const status: HealthStatus = {
                status: this.determineOverallStatus([
                    databaseHealth,
                    redisHealth,
                    emailHealth,
                    queueHealth,
                    filesystemHealth,
                    memoryHealth,
                ]),
                timestamp: new Date(),
                uptime: process.uptime(),
                version: this.appConfig.version,
                environment: this.appConfig.nodeEnv,
                services: {
                    database: databaseHealth,
                    redis: redisHealth,
                    email: emailHealth,
                    queues: queueHealth,
                    filesystem: filesystemHealth,
                    memory: memoryHealth,
                },
                metrics,
            };

            this.lastHealthCheck = status;

            // Log health check
            const responseTime = Date.now() - startTime;
            this.loggingService.logInfo('Health check completed', {
                status: status.status,
                responseTime,
                services: Object.entries(status.services).map(([name, service]) => ({
                    name,
                    status: service.status,
                })),
            });

            return status;
        } catch (error) {
            this.loggingService.logError('Health check failed', {
                error,
                additionalInfo: {
                    responseTime: Date.now() - startTime,
                },
            });

            throw error;
        }
    }

    async checkDatabase(): Promise<HealthIndicatorResult> {
        return this.db.pingCheck('database');
    }

    async checkRedis(): Promise<HealthIndicatorResult> {
        const startTime = Date.now();
        try {
            const result = await this.redisService.getClient().ping();
            const responseTime = Date.now() - startTime;

            if (result === 'PONG') {
                return {
                    redis: {
                        status: 'up',
                        responseTime: `${responseTime}ms`,
                    },
                };
            } else {
                throw new Error('Invalid ping response');
            }
        } catch (error) {
            return {
                redis: {
                    status: 'down',
                    error: error.message,
                },
            };
        }
    }

    async checkMemory(): Promise<HealthIndicatorResult> {
        // Check if heap used is less than 2GB (more reasonable threshold)
        return this.memory.checkHeap('memory_heap', 2 * 1024 * 1024 * 1024);
    }

    async checkDisk(): Promise<HealthIndicatorResult> {
        // Check if disk usage is less than 90%
        return this.disk.checkStorage('storage', {
            path: '/',
            thresholdPercent: 0.9,
        });
    }

    private async checkDatabaseHealth(): Promise<ServiceHealth> {
        const startTime = Date.now();

        try {
            // Test database connectivity and response time
            await this.userRepository.count();
            const responseTime = Date.now() - startTime;

            return {
                status: responseTime < 1000 ? 'healthy' : 'degraded',
                responseTime,
                lastChecked: new Date(),
                details: {
                    responseTimeMs: responseTime,
                    threshold: 1000,
                },
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                responseTime: Date.now() - startTime,
                lastChecked: new Date(),
                error: error.message,
            };
        }
    }

    private async checkRedisHealth(): Promise<ServiceHealth> {
        const startTime = Date.now();

        try {
            const result = await this.redisService.getClient().ping();
            const responseTime = Date.now() - startTime;

            if (result !== 'PONG') {
                throw new Error('Invalid ping response');
            }

            // Test set/get operation
            const testKey = `health_check_${Date.now()}`;
            await this.redisService.set(testKey, 'test', 5);
            const testValue = await this.redisService.get(testKey);
            await this.redisService.del(testKey);

            if (testValue !== 'test') {
                throw new Error('Redis read/write test failed');
            }

            return {
                status: responseTime < 100 ? 'healthy' : 'degraded',
                responseTime,
                lastChecked: new Date(),
                details: {
                    responseTimeMs: responseTime,
                    threshold: 100,
                },
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                responseTime: Date.now() - startTime,
                lastChecked: new Date(),
                error: error.message,
            };
        }
    }

    private async checkEmailHealth(): Promise<ServiceHealth> {
        const startTime = Date.now();

        try {
            // Check if SMTP configuration is available
            if (
                !this.emailConfig.smtp.host ||
                !this.emailConfig.smtp.auth.user ||
                !this.emailConfig.smtp.auth.pass
            ) {
                return {
                    status: 'degraded',
                    responseTime: Date.now() - startTime,
                    lastChecked: new Date(),
                    error: 'SMTP configuration missing - email service disabled',
                    details: {
                        configured: false,
                        reason: 'Environment variables not set',
                    },
                };
            }

            // Test SMTP connection with timeout
            const nodemailer = require('nodemailer');
            const transporter = nodemailer.createTransport({
                host: this.emailConfig.smtp.host,
                port: this.emailConfig.smtp.port,
                secure: this.emailConfig.smtp.secure,
                auth: {
                    user: this.emailConfig.smtp.auth.user,
                    pass: this.emailConfig.smtp.auth.pass,
                },
                connectionTimeout: 3000, // Reduced timeout
                greetingTimeout: 3000,
            });

            // Add timeout wrapper
            const verifyPromise = transporter.verify();
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('SMTP verification timeout')), 5000),
            );

            await Promise.race([verifyPromise, timeoutPromise]);
            const responseTime = Date.now() - startTime;

            return {
                status: 'healthy',
                responseTime,
                lastChecked: new Date(),
                details: {
                    smtpHost: this.emailConfig.smtp.host,
                    responseTimeMs: responseTime,
                    configured: true,
                },
            };
        } catch (error) {
            return {
                status: 'degraded',
                responseTime: Date.now() - startTime,
                lastChecked: new Date(),
                error: error.message,
                details: {
                    configured: !!this.emailConfig.smtp.host,
                    reason: 'SMTP connection failed',
                },
            };
        }
    }

    private async checkQueueHealth(): Promise<ServiceHealth> {
        const startTime = Date.now();

        try {
            // Check if Redis is available for queues
            await this.redisService.getClient().ping();

            // Create a separate Redis client for the jobs database
            const Redis = require('ioredis');
            const jobsRedis = new Redis({
                host: this.redisConfig.host,
                port: this.redisConfig.port,
                password: this.redisConfig.password,
                db: this.redisConfig.jobsDb, // Use jobs database
            });

            // Check for any Bull queue keys in the jobs database
            const queuePatterns = [
                'bull:*:waiting',
                'bull:*:active',
                'bull:*:completed',
                'bull:*:failed',
            ];

            const queueChecks = await Promise.allSettled(
                queuePatterns.map(pattern => jobsRedis.keys(pattern)),
            );

            const allKeys = queueChecks
                .filter(result => result.status === 'fulfilled')
                .flatMap(result => result.value as string[]);

            const responseTime = Date.now() - startTime;

            // Check if we have any queue infrastructure
            const hasQueueInfrastructure = allKeys.length > 0;

            // Check for specific queue types
            const queueTypes = new Set(
                allKeys.map(key => key.match(/bull:([^:]+):/)?.[1]).filter(Boolean),
            );

            let status: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';

            if (!hasQueueInfrastructure) {
                status = 'degraded'; // No queues detected, but Redis is working
            } else if (queueTypes.size === 0) {
                status = 'degraded'; // Queue keys exist but no recognizable queue types
            }

            await jobsRedis.disconnect();

            return {
                status,
                responseTime,
                lastChecked: new Date(),
                details: {
                    totalKeys: allKeys.length,
                    queueTypes: Array.from(queueTypes),
                    hasInfrastructure: hasQueueInfrastructure,
                    responseTimeMs: responseTime,
                    patterns: queuePatterns,
                    database: this.redisConfig.jobsDb,
                },
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                responseTime: Date.now() - startTime,
                lastChecked: new Date(),
                error: error.message,
                details: {
                    reason: 'Redis connection failed or queue check error',
                },
            };
        }
    }

    private async checkFilesystemHealth(): Promise<ServiceHealth> {
        const startTime = Date.now();

        try {
            const fs = require('fs').promises;
            const path = require('path');
            const os = require('os');

            // Test file write/read in temp directory
            const tempDir = os.tmpdir();
            const testFile = path.join(tempDir, `health_check_${Date.now()}.txt`);
            const testContent = `health_check_${Date.now()}`;

            await fs.writeFile(testFile, testContent);
            const readContent = await fs.readFile(testFile, 'utf8');
            await fs.unlink(testFile);

            if (readContent !== testContent) {
                throw new Error('Filesystem read/write test failed');
            }

            // Check available disk space
            const stats = (await fs.statvfs) ? await fs.statvfs(tempDir) : null;
            const responseTime = Date.now() - startTime;

            return {
                status: responseTime < 100 ? 'healthy' : 'degraded',
                responseTime,
                lastChecked: new Date(),
                details: {
                    responseTimeMs: responseTime,
                    testPath: tempDir,
                    available: stats ? stats.bavail : 'unknown',
                },
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                responseTime: Date.now() - startTime,
                lastChecked: new Date(),
                error: error.message,
            };
        }
    }

    private async checkMemoryHealth(): Promise<ServiceHealth> {
        const memoryUsage = process.memoryUsage();
        const memoryUsagePercentage = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
        const rssGB = memoryUsage.rss / (1024 * 1024 * 1024);

        let status: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';

        // More realistic thresholds for Node.js applications
        if (memoryUsagePercentage > 95 || rssGB > 1.5) {
            // 1.5GB RSS limit
            status = 'unhealthy';
        } else if (memoryUsagePercentage > 85 || rssGB > 1.0) {
            // 1GB RSS warning
            status = 'degraded';
        }

        // Log memory warnings only when approaching limits
        if (memoryUsagePercentage > 90) {
            this.loggingService.logWarning('High memory usage', {
                memoryUsage: {
                    rss: memoryUsage.rss,
                    heapTotal: memoryUsage.heapTotal,
                    heapUsed: memoryUsage.heapUsed,
                    external: memoryUsage.external,
                    arrayBuffers: memoryUsage.arrayBuffers,
                },
            });
        }

        return {
            status,
            lastChecked: new Date(),
            details: {
                heapUsed: memoryUsage.heapUsed,
                heapTotal: memoryUsage.heapTotal,
                usagePercentage: Math.round(memoryUsagePercentage * 100) / 100,
                external: memoryUsage.external,
                rss: memoryUsage.rss,
                rssGB: Math.round(rssGB * 100) / 100,
                thresholds: {
                    unhealthy: { heap: '95%', rss: '1.5GB' },
                    degraded: { heap: '85%', rss: '1.0GB' },
                },
            },
        };
    }

    private async getHealthMetrics(): Promise<{
        totalUsers: number;
        activeConnections: number;
        queueJobs: { active: number; waiting: number; failed: number };
    }> {
        try {
            const [totalUsers, queueStats] = await Promise.all([
                this.userRepository.count(),
                this.getQueueStats(),
            ]);

            return {
                totalUsers,
                activeConnections: 0, // Would need to implement connection pool monitoring
                queueJobs: queueStats,
            };
        } catch (error) {
            this.loggingService.logError('Failed to get health metrics', {
                error,
                additionalInfo: {
                    context: 'health_metrics',
                },
            });
            return {
                totalUsers: 0,
                activeConnections: 0,
                queueJobs: { active: 0, waiting: 0, failed: 0 },
            };
        }
    }

    private async getQueueStats(): Promise<{ active: number; waiting: number; failed: number }> {
        try {
            const queueNames = [
                'ai-processing',
                'payment-processing',
                'email-notifications',
                'analytics',
                'maintenance',
            ];
            let totalActive = 0;
            let totalWaiting = 0;
            let totalFailed = 0;

            // Add timeout to prevent hanging
            const timeoutPromise = new Promise<never>((_, reject) => {
                setTimeout(() => reject(new Error('Queue stats timeout')), 5000);
            });

            const statsPromise = (async () => {
                // Create a separate Redis client for the jobs database
                const Redis = require('ioredis');
                const jobsRedis = new Redis({
                    host: this.redisConfig.host,
                    port: this.redisConfig.port,
                    password: this.redisConfig.password,
                    db: this.redisConfig.jobsDb, // Use jobs database
                });

                for (const queueName of queueNames) {
                    const activeKey = `bull:${queueName}:active`;
                    const waitingKey = `bull:${queueName}:waiting`;
                    const failedKey = `bull:${queueName}:failed`;

                    // Check if keys exist and are lists before using LLEN
                    const [activeExists, waitingExists, failedExists] = await Promise.all([
                        jobsRedis.exists(activeKey),
                        jobsRedis.exists(waitingKey),
                        jobsRedis.exists(failedKey),
                    ]);

                    const [active, waiting, failed] = await Promise.all([
                        activeExists ? jobsRedis.llen(activeKey).catch(() => 0) : 0,
                        waitingExists ? jobsRedis.llen(waitingKey).catch(() => 0) : 0,
                        failedExists ? jobsRedis.llen(failedKey).catch(() => 0) : 0,
                    ]);

                    totalActive += active;
                    totalWaiting += waiting;
                    totalFailed += failed;
                }

                await jobsRedis.disconnect();

                return {
                    active: totalActive,
                    waiting: totalWaiting,
                    failed: totalFailed,
                };
            })();

            return await Promise.race([statsPromise, timeoutPromise]);
        } catch (error) {
            this.loggingService.logError('Failed to get queue stats', {
                error,
                additionalInfo: {
                    context: 'queue_stats',
                },
            });
            return { active: 0, waiting: 0, failed: 0 };
        }
    }

    private determineOverallStatus(services: ServiceHealth[]): 'ok' | 'error' {
        const hasUnhealthy = services.some(service => service.status === 'unhealthy');
        return hasUnhealthy ? 'error' : 'ok';
    }

    private startHealthMonitoring() {
        if (this.monitoringConfig.health.checkInterval) {
            const interval = this.monitoringConfig.health.checkInterval;

            if (isNaN(interval) || interval < 1000) {
                this.loggingService.logWarning(
                    'Invalid health check interval, using default 30 seconds',
                    {
                        provided: this.monitoringConfig.health.checkInterval,
                        default: 30000,
                    },
                );
                return;
            }

            this.healthCheckInterval = setInterval(async () => {
                try {
                    await this.getDetailedHealth();
                } catch (error) {
                    this.loggingService.logError('Scheduled health check failed', {
                        error,
                        additionalInfo: {
                            context: 'scheduled_health_check',
                        },
                    });
                }
            }, interval);

            this.loggingService.logInfo('Health monitoring started', {
                interval: interval,
            });
        }
    }

    onModuleDestroy() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
            this.loggingService.logInfo('Health monitoring stopped');
        }
    }

    getLastHealthCheck(): HealthStatus | null {
        return this.lastHealthCheck;
    }

    async getServiceHealth(serviceName: string): Promise<ServiceHealth | null> {
        const health = await this.getDetailedHealth();
        return (health.services as any)[serviceName] || null;
    }

    async getCachedHealthStatus(maxAgeMs: number = 30000): Promise<HealthStatus | null> {
        if (!this.lastHealthCheck) {
            return null;
        }

        const now = Date.now();
        const lastCheckTime = this.lastHealthCheck.timestamp.getTime();

        if (now - lastCheckTime > maxAgeMs) {
            return null; // Cache expired
        }

        return this.lastHealthCheck;
    }

    async getQuickHealthStatus(): Promise<{ status: 'ok' | 'error'; timestamp: Date }> {
        try {
            // Quick check using only essential services
            const [databaseResult, redisResult] = await Promise.allSettled([
                this.checkDatabaseHealth(),
                this.checkRedisHealth(),
            ]);

            const hasUnhealthy = [databaseResult, redisResult].some(
                result =>
                    result.status === 'rejected' ||
                    (result.status === 'fulfilled' && result.value.status === 'unhealthy'),
            );

            return {
                status: hasUnhealthy ? 'error' : 'ok',
                timestamp: new Date(),
            };
        } catch (error) {
            return {
                status: 'error',
                timestamp: new Date(),
            };
        }
    }
}
