import { Injectable, Logger } from '@nestjs/common';
import { DatabaseOptimizationService } from './database-optimization.service';
import { MemoryOptimizationService } from './memory-optimization.service';
import { RedisOptimizationService } from './redis-optimization.service';
import { QueryCacheService } from './query-cache.service';
import { performanceConfig, PerformanceThresholds } from '../config/performance.config';

export interface PerformanceReport {
  timestamp: Date;
  overall: {
    score: number;
    status: 'excellent' | 'good' | 'warning' | 'critical';
    recommendations: string[];
  };
  database: {
    metrics: any;
    optimizations: string[];
    score: number;
  };
  memory: {
    metrics: any;
    optimizations: string[];
    score: number;
  };
  redis: {
    metrics: any;
    optimizations: string[];
    score: number;
  };
  cache: {
    metrics: any;
    optimizations: string[];
    score: number;
  };
}

export interface PerformanceAlert {
  id: string;
  type: 'database' | 'memory' | 'redis' | 'cache' | 'overall';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
  resolved: boolean;
  data?: any;
}

/**
 * Comprehensive performance monitoring service
 * Provides unified performance monitoring and optimization
 */
@Injectable()
export class PerformanceMonitoringService {
  private readonly logger = new Logger(PerformanceMonitoringService.name);
  private alerts: PerformanceAlert[] = [];
  private readonly maxAlerts = 1000;
  private readonly thresholds: PerformanceThresholds;

  constructor(
    private readonly databaseOptimization: DatabaseOptimizationService,
    private readonly memoryOptimization: MemoryOptimizationService,
    private readonly redisOptimization: RedisOptimizationService,
    private readonly queryCache: QueryCacheService,
  ) {
    this.thresholds = performanceConfig();
  }

  /**
   * Generate comprehensive performance report
   * @returns Promise<PerformanceReport> - Performance report
   */
  async generatePerformanceReport(): Promise<PerformanceReport> {
    try {
      this.logger.log('Generating comprehensive performance report...');

      // Collect metrics from all services
      const [databaseMetrics, memoryMetrics, redisMetrics, cacheMetrics] = await Promise.all([
        this.databaseOptimization.getDatabaseMetrics(),
        Promise.resolve(this.memoryOptimization.getMemoryMetrics()),
        this.redisOptimization.getRedisMetrics(),
        this.queryCache.getCacheMetrics(),
      ]);

      // Analyze and score each component
      const databaseScore = this.calculateDatabaseScore(databaseMetrics);
      const memoryScore = this.calculateMemoryScore(memoryMetrics);
      const redisScore = this.calculateRedisScore(redisMetrics);
      const cacheScore = this.calculateCacheScore(cacheMetrics);

      // Calculate overall score
      const overallScore = (databaseScore + memoryScore + redisScore + cacheScore) / 4;
      const overallStatus = this.getOverallStatus(overallScore);

      // Generate recommendations
      const recommendations = await this.generateRecommendations({
        database: { metrics: databaseMetrics, score: databaseScore },
        memory: { metrics: memoryMetrics, score: memoryScore },
        redis: { metrics: redisMetrics, score: redisScore },
        cache: { metrics: cacheMetrics, score: cacheScore },
      });

      const report: PerformanceReport = {
        timestamp: new Date(),
        overall: {
          score: overallScore,
          status: overallStatus,
          recommendations,
        },
        database: {
          metrics: databaseMetrics,
          optimizations: await this.getDatabaseOptimizations(),
          score: databaseScore,
        },
        memory: {
          metrics: memoryMetrics,
          optimizations: this.memoryOptimization.getOptimizationRecommendations(),
          score: memoryScore,
        },
        redis: {
          metrics: redisMetrics,
          optimizations: await this.redisOptimization.getOptimizationRecommendations(),
          score: redisScore,
        },
        cache: {
          metrics: cacheMetrics,
          optimizations: await this.getCacheOptimizations(cacheMetrics),
          score: cacheScore,
        },
      };

      this.logger.log(`Performance report generated. Overall score: ${overallScore.toFixed(2)}`);
      return report;
    } catch (error) {
      this.logger.error('Error generating performance report:', error);
      throw error;
    }
  }

  /**
   * Perform comprehensive performance optimization
   * @returns Promise<object> - Optimization results
   */
  async optimizePerformance(): Promise<object> {
    try {
      this.logger.log('Starting comprehensive performance optimization...');

      const results = {
        database: await this.databaseOptimization.optimizeIndexes(),
        memory: await this.memoryOptimization.optimizeMemory(),
        redis: await this.redisOptimization.optimizeRedis(),
        cache: await this.optimizeCache(),
      };

      this.logger.log('Performance optimization completed');
      return results;
    } catch (error) {
      this.logger.error('Error optimizing performance:', error);
      throw error;
    }
  }

  /**
   * Monitor performance and create alerts if needed
   * @returns Promise<void>
   */
  async monitorPerformance(): Promise<void> {
    try {
      const report = await this.generatePerformanceReport();
      
      // Check for performance issues and create alerts
      await this.checkPerformanceAlerts(report);
      
      // Auto-optimize if critical issues are detected
      if (report.overall.status === 'critical') {
        this.logger.warn('Critical performance issues detected, starting auto-optimization...');
        await this.optimizePerformance();
      }
    } catch (error) {
      this.logger.error('Error monitoring performance:', error);
    }
  }

  /**
   * Get performance alerts
   * @returns PerformanceAlert[] - Current alerts
   */
  getAlerts(): PerformanceAlert[] {
    return this.alerts.filter(alert => !alert.resolved);
  }

  /**
   * Resolve an alert
   * @param alertId - Alert ID
   * @returns Promise<boolean> - Success status
   */
  async resolveAlert(alertId: string): Promise<boolean> {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      this.logger.log(`Alert ${alertId} resolved`);
      return true;
    }
    return false;
  }

  /**
   * Get performance trends
   * @param duration - Duration in hours
   * @returns Promise<object> - Performance trends
   */
  async getPerformanceTrends(duration: number = 24): Promise<object> {
    // This would typically store historical data
    // For now, return current metrics
    const report = await this.generatePerformanceReport();
    return {
      duration,
      current: report,
      trends: {
        database: { score: report.database.score, trend: 'stable' },
        memory: { score: report.memory.score, trend: 'stable' },
        redis: { score: report.redis.score, trend: 'stable' },
        cache: { score: report.cache.score, trend: 'stable' },
      },
    };
  }

  /**
   * Calculate database performance score
   * @param metrics - Database metrics
   * @returns number - Score (0-100)
   */
  private calculateDatabaseScore(metrics: any): number {
    let score = 100;

    // Penalize slow queries
    if (metrics.queryPerformance.slowQueries > 10) {
      score -= 20;
    }

    // Penalize low cache hit rate
    if (metrics.cache.hitRate < 0.8) {
      score -= 15;
    }

    // Penalize high average query time
    if (metrics.queryPerformance.averageQueryTime > 100) {
      score -= 25;
    }

    // Penalize connection pool issues
    if (metrics.connectionPool.waiting > 5) {
      score -= 10;
    }

    return Math.max(0, score);
  }

  /**
   * Calculate memory performance score
   * @param metrics - Memory metrics
   * @returns number - Score (0-100)
   */
  private calculateMemoryScore(metrics: any): number {
    let score = 100;

    // Penalize high memory usage
    if (metrics.heap.percentage > 90) {
      score -= 30;
    } else if (metrics.heap.percentage > 80) {
      score -= 15;
    }

    // Penalize high external memory
    if (metrics.external > 100 * 1024 * 1024) { // 100MB
      score -= 20;
    }

    // Penalize frequent GC
    if (metrics.gc.count > 100) {
      score -= 10;
    }

    return Math.max(0, score);
  }

  /**
   * Calculate Redis performance score
   * @param metrics - Redis metrics
   * @returns number - Score (0-100)
   */
  private calculateRedisScore(metrics: any): number {
    let score = 100;

    // Penalize high fragmentation
    if (metrics.memory.fragmentation > 1.5) {
      score -= 20;
    }

    // Penalize high latency
    if (metrics.performance.averageLatency > 10) {
      score -= 25;
    }

    // Penalize low hit rate
    if (metrics.performance.hitRate < 0.8) {
      score -= 15;
    }

    // Penalize many slow operations
    if (metrics.operations.slowLog > 100) {
      score -= 10;
    }

    return Math.max(0, score);
  }

  /**
   * Calculate cache performance score
   * @param metrics - Cache metrics
   * @returns number - Score (0-100)
   */
  private calculateCacheScore(metrics: any): number {
    let score = 100;

    // Penalize low hit rate
    if (metrics.hitRate < 0.8) {
      score -= 30;
    }

    // Penalize high latency
    if (metrics.averageLatency > 5) {
      score -= 20;
    }

    // Penalize too many keys
    if (metrics.totalKeys > 10000) {
      score -= 10;
    }

    return Math.max(0, score);
  }

  /**
   * Get overall performance status
   * @param score - Overall score
   * @returns string - Status
   */
  private getOverallStatus(score: number): 'excellent' | 'good' | 'warning' | 'critical' {
    if (score >= 90) return 'excellent';
    if (score >= this.thresholds.overall.warningScore) return 'good';
    if (score >= this.thresholds.overall.criticalScore) return 'warning';
    return 'critical';
  }

  /**
   * Generate performance recommendations
   * @param scores - Component scores
   * @returns Promise<string[]> - Recommendations
   */
  private async generateRecommendations(scores: any): Promise<string[]> {
    const recommendations: string[] = [];

    if (scores.database.score < 70) {
      recommendations.push('Database performance needs attention - consider optimizing queries and indexes');
    }

    if (scores.memory.score < 70) {
      recommendations.push('Memory usage is high - consider optimizing memory usage patterns');
    }

    if (scores.redis.score < 70) {
      recommendations.push('Redis performance needs optimization - check fragmentation and latency');
    }

    if (scores.cache.score < 70) {
      recommendations.push('Cache performance is poor - consider optimizing cache strategies');
    }

    return recommendations;
  }

  /**
   * Get database optimizations
   * @returns Promise<string[]> - Database optimizations
   */
  private async getDatabaseOptimizations(): Promise<string[]> {
    try {
      const slowQueries = await this.databaseOptimization.getSlowQueriesReport();
      return slowQueries.map(sq => `Slow query detected: ${sq.query} (avg: ${sq.avgTime}ms)`);
    } catch (error) {
      this.logger.error('Error getting database optimizations:', error);
      return [];
    }
  }

  /**
   * Get cache optimizations
   * @param metrics - Cache metrics
   * @returns Promise<string[]> - Cache optimizations
   */
  private async getCacheOptimizations(metrics: any): Promise<string[]> {
    const optimizations: string[] = [];

    if (metrics.hitRate < 0.8) {
      optimizations.push('Low cache hit rate - consider optimizing cache keys and TTL');
    }

    if (metrics.averageLatency > 5) {
      optimizations.push('High cache latency - consider optimizing Redis configuration');
    }

    if (metrics.totalKeys > 10000) {
      optimizations.push('Too many cache keys - consider implementing key expiration');
    }

    return optimizations;
  }

  /**
   * Optimize cache performance
   * @returns Promise<object> - Cache optimization results
   */
  private async optimizeCache(): Promise<object> {
    try {
      const cleared = await this.queryCache.clearAll();
      return {
        cleared,
        message: 'Cache optimization completed',
      };
    } catch (error) {
      this.logger.error('Error optimizing cache:', error);
      return { cleared: false, message: 'Cache optimization failed' };
    }
  }

  /**
   * Check for performance alerts
   * @param report - Performance report
   * @returns Promise<void>
   */
  private async checkPerformanceAlerts(report: PerformanceReport): Promise<void> {
    // Check overall performance
    if (report.overall.status === 'critical') {
      this.createAlert('overall', 'critical', 'Critical performance issues detected', report.overall);
    } else if (report.overall.status === 'warning') {
      this.createAlert('overall', 'medium', 'Performance warning detected', report.overall);
    }

    // Check individual components
    if (report.database.score < 60) {
      this.createAlert('database', 'high', 'Database performance is poor', report.database);
    }

    if (report.memory.score < 60) {
      this.createAlert('memory', 'high', 'Memory usage is critical', report.memory);
    }

    if (report.redis.score < 60) {
      this.createAlert('redis', 'high', 'Redis performance is poor', report.redis);
    }

    if (report.cache.score < 60) {
      this.createAlert('cache', 'medium', 'Cache performance is poor', report.cache);
    }
  }

  /**
   * Create a performance alert
   * @param type - Alert type
   * @param severity - Alert severity
   * @param message - Alert message
   * @param data - Alert data
   * @returns void
   */
  private createAlert(type: string, severity: string, message: string, data?: any): void {
    const alert: PerformanceAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: type as any,
      severity: severity as any,
      message,
      timestamp: new Date(),
      resolved: false,
      data,
    };

    this.alerts.push(alert);

    // Keep only recent alerts
    if (this.alerts.length > this.maxAlerts) {
      this.alerts = this.alerts.slice(-this.maxAlerts);
    }

    this.logger.warn(`Performance alert created: ${message}`);
  }
}
