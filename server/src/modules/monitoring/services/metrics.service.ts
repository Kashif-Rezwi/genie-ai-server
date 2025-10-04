import { Injectable } from '@nestjs/common';
import { LoggingService } from './logging.service';

export interface MetricsData {
  requests: {
    total: number;
    success: number;
    errors: number;
    avgResponseTime: number;
    byMethod: Record<string, number>;
    byEndpoint: Record<string, number>;
    byStatus: Record<number, number>;
  };
  errors: {
    total: number;
    byStatus: Record<number, number>;
    byEndpoint: Record<string, number>;
    byType: Record<string, number>;
    recent: Array<{
      timestamp: Date;
      message: string;
      endpoint: string;
      severity: string;
    }>;
  };
  performance: {
    slowQueries: number;
    memoryUsage: number;
    cpuUsage: number;
    uptime: number;
    responseTimePercentiles: {
      p50: number;
      p95: number;
      p99: number;
    };
  };
  business: {
    aiRequests: number;
    creditsUsed: number;
    activeUsers: number;
    newUsers: number;
    revenue: number;
    conversionRate: number;
    popularModels: Record<string, number>;
  };
  security: {
    failedLogins: number;
    rateLimitExceeded: number;
    csrfViolations: number;
    suspiciousActivity: number;
  };
  system: {
    databaseConnections: number;
    redisConnections: number;
    queueSize: number;
    cacheHitRate: number;
  };
}

@Injectable()
export class MetricsService {
  private metrics: MetricsData = {
    requests: {
      total: 0,
      success: 0,
      errors: 0,
      avgResponseTime: 0,
      byMethod: {},
      byEndpoint: {},
      byStatus: {},
    },
    errors: {
      total: 0,
      byStatus: {},
      byEndpoint: {},
      byType: {},
      recent: [],
    },
    performance: {
      slowQueries: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      uptime: 0,
      responseTimePercentiles: { p50: 0, p95: 0, p99: 0 },
    },
    business: {
      aiRequests: 0,
      creditsUsed: 0,
      activeUsers: 0,
      newUsers: 0,
      revenue: 0,
      conversionRate: 0,
      popularModels: {},
    },
    security: {
      failedLogins: 0,
      rateLimitExceeded: 0,
      csrfViolations: 0,
      suspiciousActivity: 0,
    },
    system: {
      databaseConnections: 0,
      redisConnections: 0,
      queueSize: 0,
      cacheHitRate: 0,
    },
  };

  private responseTimes: number[] = [];
  private readonly maxResponseTimeSamples = 1000;

  constructor(private readonly loggingService: LoggingService) {}

  // Request metrics
  recordRequest(method: string, url: string, statusCode: number, responseTime: number) {
    this.metrics.requests.total++;

    // Track by method
    this.metrics.requests.byMethod[method] = (this.metrics.requests.byMethod[method] || 0) + 1;

    // Track by endpoint
    const endpoint = this.normalizeEndpoint(url);
    this.metrics.requests.byEndpoint[endpoint] =
      (this.metrics.requests.byEndpoint[endpoint] || 0) + 1;

    // Track by status
    this.metrics.requests.byStatus[statusCode] =
      (this.metrics.requests.byStatus[statusCode] || 0) + 1;

    if (statusCode >= 400) {
      this.metrics.requests.errors++;
      this.metrics.errors.total++;

      // Track errors by status code
      this.metrics.errors.byStatus[statusCode] =
        (this.metrics.errors.byStatus[statusCode] || 0) + 1;

      // Track errors by endpoint
      this.metrics.errors.byEndpoint[endpoint] =
        (this.metrics.errors.byEndpoint[endpoint] || 0) + 1;

      // Add to recent errors
      this.metrics.errors.recent.push({
        timestamp: new Date(),
        message: `HTTP ${statusCode}`,
        endpoint,
        severity: statusCode >= 500 ? 'high' : 'medium',
      });

      // Keep only last 50 recent errors
      if (this.metrics.errors.recent.length > 50) {
        this.metrics.errors.recent.shift();
      }
    } else {
      this.metrics.requests.success++;
    }

    // Track response times for average calculation
    this.responseTimes.push(responseTime);
    if (this.responseTimes.length > this.maxResponseTimeSamples) {
      this.responseTimes.shift();
    }

    this.metrics.requests.avgResponseTime = this.calculateAverageResponseTime();
    this.updateResponseTimePercentiles();

    // Track slow queries
    if (responseTime > 1000) {
      // 1 second threshold
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
  }

  // Get current metrics
  getMetrics(): MetricsData {
    this.updatePerformanceMetrics();
    return { ...this.metrics };
  }

  // Reset metrics (useful for testing or periodic resets)
  resetMetrics() {
    this.metrics = {
      requests: {
        total: 0,
        success: 0,
        errors: 0,
        avgResponseTime: 0,
        byMethod: {},
        byEndpoint: {},
        byStatus: {},
      },
      errors: {
        total: 0,
        byStatus: {},
        byEndpoint: {},
        byType: {},
        recent: [],
      },
      performance: {
        slowQueries: 0,
        memoryUsage: 0,
        cpuUsage: 0,
        uptime: 0,
        responseTimePercentiles: { p50: 0, p95: 0, p99: 0 },
      },
      business: {
        aiRequests: 0,
        creditsUsed: 0,
        activeUsers: 0,
        newUsers: 0,
        revenue: 0,
        conversionRate: 0,
        popularModels: {},
      },
      security: {
        failedLogins: 0,
        rateLimitExceeded: 0,
        csrfViolations: 0,
        suspiciousActivity: 0,
      },
      system: {
        databaseConnections: 0,
        redisConnections: 0,
        queueSize: 0,
        cacheHitRate: 0,
      },
    };
    this.responseTimes = [];
  }

  // Get metrics summary for logging
  getMetricsSummary(): string {
    const { requests, errors, performance, business } = this.metrics;
    return (
      `Metrics - Requests: ${requests.total} (${requests.success} success, ${requests.errors} errors), ` +
      `Avg Response: ${requests.avgResponseTime}ms, ` +
      `Memory: ${performance.memoryUsage}MB, ` +
      `AI Requests: ${business.aiRequests}, ` +
      `Credits Used: ${business.creditsUsed}`
    );
  }

  private calculateAverageResponseTime(): number {
    if (this.responseTimes.length === 0) return 0;
    const sum = this.responseTimes.reduce((a, b) => a + b, 0);
    return Math.round(sum / this.responseTimes.length);
  }

  private normalizeEndpoint(url: string): string {
    // Normalize URL to group similar endpoints
    return url.replace(/\/\d+/g, '/:id').replace(/\?.*$/, '');
  }

  // Enhanced business metrics
  recordNewUser() {
    this.metrics.business.newUsers++;
  }

  recordRevenue(amount: number) {
    this.metrics.business.revenue += amount;
  }

  recordModelUsage(model: string) {
    this.metrics.business.popularModels[model] =
      (this.metrics.business.popularModels[model] || 0) + 1;
  }

  updateConversionRate() {
    if (this.metrics.business.newUsers > 0) {
      this.metrics.business.conversionRate =
        this.metrics.business.aiRequests / this.metrics.business.newUsers;
    }
  }

  // Security metrics
  recordFailedLogin() {
    this.metrics.security.failedLogins++;
  }

  recordRateLimitExceeded() {
    this.metrics.security.rateLimitExceeded++;
  }

  recordCSRFViolation() {
    this.metrics.security.csrfViolations++;
  }

  recordSuspiciousActivity() {
    this.metrics.security.suspiciousActivity++;
  }

  // System metrics
  updateSystemMetrics() {
    // Update CPU usage (simplified for MVP)
    this.metrics.performance.cpuUsage = this.calculateCPUUsage();

    // Update system connections (placeholder for MVP)
    this.metrics.system.databaseConnections = 1; // Simplified
    this.metrics.system.redisConnections = 1; // Simplified
    this.metrics.system.queueSize = 0; // No queue in MVP
    this.metrics.system.cacheHitRate = 0.85; // Placeholder
  }

  // Error tracking
  recordError(
    error: Error,
    endpoint: string,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ) {
    this.metrics.errors.total++;

    // Track by error type
    const errorType = error.constructor.name;
    this.metrics.errors.byType[errorType] = (this.metrics.errors.byType[errorType] || 0) + 1;

    // Track by endpoint
    const normalizedEndpoint = this.normalizeEndpoint(endpoint);
    this.metrics.errors.byEndpoint[normalizedEndpoint] =
      (this.metrics.errors.byEndpoint[normalizedEndpoint] || 0) + 1;

    // Add to recent errors
    this.metrics.errors.recent.push({
      timestamp: new Date(),
      message: error.message,
      endpoint: normalizedEndpoint,
      severity,
    });

    // Keep only last 50 recent errors
    if (this.metrics.errors.recent.length > 50) {
      this.metrics.errors.recent.shift();
    }
  }

  // Helper methods
  private updateResponseTimePercentiles() {
    if (this.responseTimes.length === 0) return;

    const sorted = [...this.responseTimes].sort((a, b) => a - b);
    const len = sorted.length;

    this.metrics.performance.responseTimePercentiles.p50 = sorted[Math.floor(len * 0.5)];
    this.metrics.performance.responseTimePercentiles.p95 = sorted[Math.floor(len * 0.95)];
    this.metrics.performance.responseTimePercentiles.p99 = sorted[Math.floor(len * 0.99)];
  }

  private calculateCPUUsage(): number {
    // Simplified CPU usage calculation for MVP
    // In production, this would use a proper CPU monitoring library
    return Math.random() * 100; // Placeholder
  }

  // Get specific metric categories
  getRequestMetrics() {
    return this.metrics.requests;
  }

  getErrorMetrics() {
    return this.metrics.errors;
  }

  getPerformanceMetrics() {
    this.updatePerformanceMetrics();
    return this.metrics.performance;
  }

  getBusinessMetrics() {
    return this.metrics.business;
  }

  getSecurityMetrics() {
    return this.metrics.security;
  }

  getSystemMetrics() {
    this.updateSystemMetrics();
    return this.metrics.system;
  }
}
