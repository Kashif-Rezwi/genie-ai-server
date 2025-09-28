import { Injectable } from '@nestjs/common';
import { LoggingService } from './logging.service';
import { MetricsService } from './metrics.service';
import { monitoringConfig } from '../../../config';

export interface PerformanceMetrics {
    requests: {
        total: number;
        successful: number;
        failed: number;
        averageResponseTime: number;
        p95ResponseTime: number;
        p99ResponseTime: number;
    };
    database: {
        activeConnections: number;
        queryCount: number;
        averageQueryTime: number;
        slowQueries: number;
    };
    memory: {
        heapUsed: number;
        heapTotal: number;
        external: number;
        rss: number;
        usagePercentage: number;
    };
    cpu: {
        usage: number;
        loadAverage: number[];
    };
    errors: {
        rate: number;
        count: number;
        recentErrors: Array<{
            timestamp: Date;
            message: string;
            stack?: string;
        }>;
    };
}

@Injectable()
export class PerformanceService {
    private readonly config = monitoringConfig();

    private requestMetrics: Array<{
        timestamp: Date;
        responseTime: number;
        statusCode: number;
        method: string;
        url: string;
    }> = [];

    private errorMetrics: Array<{
        timestamp: Date;
        message: string;
        stack?: string;
    }> = [];

    private queryMetrics: Array<{
        timestamp: Date;
        query: string;
        duration: number;
    }> = [];

    private readonly maxMetricsHistory = 10000;

    constructor(
        private readonly loggingService: LoggingService,
        private readonly metricsService: MetricsService,
    ) {
        this.startPerformanceMonitoring();
    }

    private startPerformanceMonitoring() {
        // Monitor system metrics every minute
        setInterval(() => {
            this.collectSystemMetrics();
        }, 60000);

        // Clean old metrics every hour
        setInterval(() => {
            this.cleanOldMetrics();
        }, 3600000);
    }

    recordRequest(data: { responseTime: number; statusCode: number; method: string; url: string }) {
        this.requestMetrics.push({
            timestamp: new Date(),
            ...data,
        });

        // Record in metrics service
        this.metricsService.incrementCounter('http_requests_total', {
            method: data.method,
            status: data.statusCode.toString(),
        });

        this.metricsService.recordHistogram('http_request_duration_ms', data.responseTime, {
            method: data.method,
            status: data.statusCode.toString(),
        });

        // Log slow requests
        if (data.responseTime > this.config.performance.requestTimeoutThreshold) {
            this.loggingService.logPerformance(
                `Slow request: ${data.method} ${data.url}`,
                data.responseTime,
                {
                    method: data.method,
                    url: data.url,
                    statusCode: data.statusCode,
                },
            );
        }

        // Keep only recent metrics
        if (this.requestMetrics.length > this.maxMetricsHistory) {
            this.requestMetrics = this.requestMetrics.slice(-this.maxMetricsHistory / 2);
        }
    }

    recordError(error: Error, context?: any) {
        this.errorMetrics.push({
            timestamp: new Date(),
            message: error.message,
            stack: error.stack,
        });

        this.metricsService.incrementCounter('errors_total', {
            type: error.constructor.name,
        });

        this.loggingService.logError('Application error recorded', {
            error,
            context,
        });

        // Keep only recent errors
        if (this.errorMetrics.length > 1000) {
            this.errorMetrics = this.errorMetrics.slice(-500);
        }
    }

    recordDatabaseQuery(query: string, duration: number) {
        this.queryMetrics.push({
            timestamp: new Date(),
            query,
            duration,
        });

        this.metricsService.recordHistogram('database_query_duration_ms', duration);

        // Log slow queries
        this.loggingService.logSlowQuery(query, duration);

        // Keep only recent queries
        if (this.queryMetrics.length > this.maxMetricsHistory) {
            this.queryMetrics = this.queryMetrics.slice(-this.maxMetricsHistory / 2);
        }
    }

    async getPerformanceMetrics(timeRange: number = 3600000): Promise<PerformanceMetrics> {
        const since = new Date(Date.now() - timeRange);

        // Filter metrics by time range
        const recentRequests = this.requestMetrics.filter(m => m.timestamp >= since);
        const recentErrors = this.errorMetrics.filter(m => m.timestamp >= since);
        const recentQueries = this.queryMetrics.filter(m => m.timestamp >= since);

        // Calculate request metrics
        const responseTimes = recentRequests.map(r => r.responseTime);
        const successfulRequests = recentRequests.filter(r => r.statusCode < 400).length;
        const failedRequests = recentRequests.length - successfulRequests;

        // Calculate percentiles
        const sortedResponseTimes = responseTimes.sort((a, b) => a - b);
        const p95Index = Math.floor(sortedResponseTimes.length * 0.95);
        const p99Index = Math.floor(sortedResponseTimes.length * 0.99);

        // Calculate database metrics
        const queryDurations = recentQueries.map(q => q.duration);
        const slowQueries = recentQueries.filter(q => q.duration > 1000).length;

        // Get system metrics
        const memoryUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();

        return {
            requests: {
                total: recentRequests.length,
                successful: successfulRequests,
                failed: failedRequests,
                averageResponseTime:
                    responseTimes.length > 0
                        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
                        : 0,
                p95ResponseTime: sortedResponseTimes[p95Index] || 0,
                p99ResponseTime: sortedResponseTimes[p99Index] || 0,
            },
            database: {
                activeConnections: 0, // Would need database connection pool info
                queryCount: recentQueries.length,
                averageQueryTime:
                    queryDurations.length > 0
                        ? queryDurations.reduce((a, b) => a + b, 0) / queryDurations.length
                        : 0,
                slowQueries,
            },
            memory: {
                heapUsed: memoryUsage.heapUsed,
                heapTotal: memoryUsage.heapTotal,
                external: memoryUsage.external,
                rss: memoryUsage.rss,
                usagePercentage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
            },
            cpu: {
                usage: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to seconds
                loadAverage: require('os').loadavg(),
            },
            errors: {
                rate: recentErrors.length / (timeRange / 3600000), // Errors per hour
                count: recentErrors.length,
                recentErrors: recentErrors.slice(-10).map(e => ({
                    timestamp: e.timestamp,
                    message: e.message,
                    stack: e.stack,
                })),
            },
        };
    }

    async getResponseTimeDistribution(timeRange: number = 3600000): Promise<{
        buckets: Array<{ range: string; count: number }>;
        percentiles: { p50: number; p75: number; p90: number; p95: number; p99: number };
    }> {
        const since = new Date(Date.now() - timeRange);
        const recentRequests = this.requestMetrics.filter(m => m.timestamp >= since);
        const responseTimes = recentRequests.map(r => r.responseTime).sort((a, b) => a - b);

        // Create buckets
        const buckets = [
            { range: '0-100ms', count: 0 },
            { range: '100-500ms', count: 0 },
            { range: '500ms-1s', count: 0 },
            { range: '1-5s', count: 0 },
            { range: '5s+', count: 0 },
        ];

        responseTimes.forEach(time => {
            if (time <= 100) buckets[0].count++;
            else if (time <= 500) buckets[1].count++;
            else if (time <= 1000) buckets[2].count++;
            else if (time <= 5000) buckets[3].count++;
            else buckets[4].count++;
        });

        // Calculate percentiles
        const percentiles = {
            p50: this.getPercentile(responseTimes, 0.5),
            p75: this.getPercentile(responseTimes, 0.75),
            p90: this.getPercentile(responseTimes, 0.9),
            p95: this.getPercentile(responseTimes, 0.95),
            p99: this.getPercentile(responseTimes, 0.99),
        };

        return { buckets, percentiles };
    }

    async getTopSlowEndpoints(limit: number = 10): Promise<
        Array<{
            endpoint: string;
            method: string;
            averageResponseTime: number;
            requestCount: number;
            errorRate: number;
        }>
    > {
        const recentRequests = this.requestMetrics.filter(
            m => m.timestamp >= new Date(Date.now() - 3600000),
        );

        // Group by endpoint
        const endpointStats = new Map<
            string,
            {
                responseTimes: number[];
                errorCount: number;
                totalCount: number;
            }
        >();

        recentRequests.forEach(request => {
            const key = `${request.method} ${request.url}`;
            if (!endpointStats.has(key)) {
                endpointStats.set(key, { responseTimes: [], errorCount: 0, totalCount: 0 });
            }

            const stats = endpointStats.get(key)!;
            stats.responseTimes.push(request.responseTime);
            stats.totalCount++;
            if (request.statusCode >= 400) {
                stats.errorCount++;
            }
        });

        // Calculate averages and sort
        const results = Array.from(endpointStats.entries())
            .map(([endpoint, stats]) => {
                const [method, url] = endpoint.split(' ', 2);
                return {
                    endpoint: url,
                    method,
                    averageResponseTime:
                        stats.responseTimes.reduce((a, b) => a + b, 0) / stats.responseTimes.length,
                    requestCount: stats.totalCount,
                    errorRate: (stats.errorCount / stats.totalCount) * 100,
                };
            })
            .sort((a, b) => b.averageResponseTime - a.averageResponseTime)
            .slice(0, limit);

        return results;
    }

    private collectSystemMetrics() {
        const memoryUsage = process.memoryUsage();
        const memoryUsagePercentage = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;

        // Record system metrics
        this.metricsService.recordGauge('memory_usage_bytes', memoryUsage.heapUsed);
        this.metricsService.recordGauge('memory_usage_percentage', memoryUsagePercentage);

        // Alert on high memory usage
        if (memoryUsagePercentage > this.config.performance.memoryUsageThreshold) {
            this.loggingService.logWarning(
                `High memory usage: ${memoryUsagePercentage.toFixed(2)}%`,
                {
                    memoryUsage: memoryUsage,
                },
            );
        }

        // Record CPU metrics
        const cpuUsage = process.cpuUsage();
        this.metricsService.recordGauge('cpu_usage_user', cpuUsage.user);
        this.metricsService.recordGauge('cpu_usage_system', cpuUsage.system);

        // Record load average
        const loadAverage = require('os').loadavg();
        this.metricsService.recordGauge('load_average_1m', loadAverage[0]);
        this.metricsService.recordGauge('load_average_5m', loadAverage[1]);
        this.metricsService.recordGauge('load_average_15m', loadAverage[2]);
    }

    private cleanOldMetrics() {
        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours

        this.requestMetrics = this.requestMetrics.filter(m => m.timestamp >= cutoff);
        this.errorMetrics = this.errorMetrics.filter(m => m.timestamp >= cutoff);
        this.queryMetrics = this.queryMetrics.filter(m => m.timestamp >= cutoff);

        this.loggingService.logInfo('Cleaned old performance metrics', {
            requestMetricsCount: this.requestMetrics.length,
            errorMetricsCount: this.errorMetrics.length,
            queryMetricsCount: this.queryMetrics.length,
        });
    }

    private getPercentile(sortedArray: number[], percentile: number): number {
        if (sortedArray.length === 0) return 0;
        const index = Math.floor(sortedArray.length * percentile);
        return sortedArray[index] || 0;
    }
}
