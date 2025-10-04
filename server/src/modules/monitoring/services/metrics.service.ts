import { Injectable } from '@nestjs/common';
import { LoggingService } from './logging.service';

export interface MetricsData {
    requests: {
        total: number;
        success: number;
        errors: number;
        avgResponseTime: number;
    };
    errors: {
        total: number;
        byStatus: Record<number, number>;
        byEndpoint: Record<string, number>;
    };
    performance: {
        slowQueries: number;
        memoryUsage: number;
        uptime: number;
        cpuUsage: number;
        responseTimeP95: number;
        responseTimeP99: number;
        throughput: number;
    };
    business: {
        aiRequests: number;
        creditsUsed: number;
        activeUsers: number;
    };
}

@Injectable()
export class MetricsService {
    private metrics: MetricsData = {
        requests: { total: 0, success: 0, errors: 0, avgResponseTime: 0 },
        errors: { total: 0, byStatus: {}, byEndpoint: {} },
        performance: { 
            slowQueries: 0, 
            memoryUsage: 0, 
            uptime: 0, 
            cpuUsage: 0, 
            responseTimeP95: 0, 
            responseTimeP99: 0, 
            throughput: 0 
        },
        business: { aiRequests: 0, creditsUsed: 0, activeUsers: 0 },
    };

    private responseTimes: number[] = [];
    private readonly maxResponseTimeSamples = 1000;

    constructor(private readonly loggingService: LoggingService) {}

    // Request metrics
    recordRequest(method: string, url: string, statusCode: number, responseTime: number) {
        this.metrics.requests.total++;
        
        if (statusCode >= 400) {
            this.metrics.requests.errors++;
            this.metrics.errors.total++;
            
            // Track errors by status code
            this.metrics.errors.byStatus[statusCode] = (this.metrics.errors.byStatus[statusCode] || 0) + 1;
            
            // Track errors by endpoint
            const endpoint = `${method} ${url}`;
            this.metrics.errors.byEndpoint[endpoint] = (this.metrics.errors.byEndpoint[endpoint] || 0) + 1;
        } else {
            this.metrics.requests.success++;
        }

        // Track response times for average calculation
        this.responseTimes.push(responseTime);
        if (this.responseTimes.length > this.maxResponseTimeSamples) {
            this.responseTimes.shift();
        }
        
        this.metrics.requests.avgResponseTime = this.calculateAverageResponseTime();

        // Track slow queries
        if (responseTime > 1000) { // 1 second threshold
            this.metrics.performance.slowQueries++;
        }
    }

    // Business metrics
    recordAIRequest(creditsUsed: number = 1) {
        this.metrics.business.aiRequests++;
        this.metrics.business.creditsUsed += creditsUsed;
    }

    recordActiveUser() {
        this.metrics.business.activeUsers++;
    }

    // Performance metrics
    updatePerformanceMetrics() {
        const memUsage = process.memoryUsage();
        this.metrics.performance.memoryUsage = Math.round(memUsage.heapUsed / 1024 / 1024); // MB
        this.metrics.performance.uptime = Math.round(process.uptime());
        this.metrics.performance.cpuUsage = this.getCpuUsage();
        this.metrics.performance.responseTimeP95 = this.calculatePercentile(this.responseTimes, 95);
        this.metrics.performance.responseTimeP99 = this.calculatePercentile(this.responseTimes, 99);
        this.metrics.performance.throughput = this.calculateThroughput();
    }

    // Get current metrics
    getMetrics(): MetricsData {
        this.updatePerformanceMetrics();
        return { ...this.metrics };
    }

    // Reset metrics (useful for testing or periodic resets)
    resetMetrics() {
        this.metrics = {
            requests: { total: 0, success: 0, errors: 0, avgResponseTime: 0 },
            errors: { total: 0, byStatus: {}, byEndpoint: {} },
            performance: { 
                slowQueries: 0, 
                memoryUsage: 0, 
                uptime: 0, 
                cpuUsage: 0, 
                responseTimeP95: 0, 
                responseTimeP99: 0, 
                throughput: 0 
            },
            business: { aiRequests: 0, creditsUsed: 0, activeUsers: 0 },
        };
        this.responseTimes = [];
    }

    // Get metrics summary for logging
    getMetricsSummary(): string {
        const { requests, errors, performance, business } = this.metrics;
        return `Metrics - Requests: ${requests.total} (${requests.success} success, ${requests.errors} errors), ` +
               `Avg Response: ${requests.avgResponseTime}ms, ` +
               `Memory: ${performance.memoryUsage}MB, ` +
               `AI Requests: ${business.aiRequests}, ` +
               `Credits Used: ${business.creditsUsed}`;
    }

    private calculateAverageResponseTime(): number {
        if (this.responseTimes.length === 0) return 0;
        const sum = this.responseTimes.reduce((a, b) => a + b, 0);
        return Math.round(sum / this.responseTimes.length);
    }

    private calculatePercentile(responseTimes: number[], percentile: number): number {
        if (responseTimes.length === 0) return 0;
        const sorted = [...responseTimes].sort((a, b) => a - b);
        const index = Math.ceil((percentile / 100) * sorted.length) - 1;
        return sorted[index] || 0;
    }

    private calculateThroughput(): number {
        // Calculate requests per minute
        const uptimeMinutes = process.uptime() / 60;
        return uptimeMinutes > 0 ? Math.round(this.metrics.requests.total / uptimeMinutes) : 0;
    }

    private getCpuUsage(): number {
        const usage = process.cpuUsage();
        const totalUsage = usage.user + usage.system;
        const uptime = process.uptime() * 1000000; // Convert to microseconds
        return uptime > 0 ? Math.round((totalUsage / uptime) * 100) : 0;
    }
}
