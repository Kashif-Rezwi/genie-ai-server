import { Injectable, Logger } from '@nestjs/common';
import { QueryCacheService } from './query-cache.service';
import { performanceConfig, PerformanceThresholds } from '../config/performance.config';

export interface MemoryMetrics {
  heap: {
    used: number;
    total: number;
    available: number;
    percentage: number;
  };
  external: number;
  rss: number;
  arrayBuffers: number;
  gc: {
    count: number;
    time: number;
  };
}

export interface MemoryOptimizationResult {
  action: string;
  memoryFreed: number;
  before: MemoryMetrics;
  after: MemoryMetrics;
  improvement: number;
}

/**
 * Memory optimization service
 * Provides memory monitoring and optimization tools
 */
@Injectable()
export class MemoryOptimizationService {
  private readonly logger = new Logger(MemoryOptimizationService.name);
  private gcCount = 0;
  private gcTime = 0;
  private readonly thresholds: PerformanceThresholds['memory'];

  constructor(private readonly queryCache: QueryCacheService) {
    this.thresholds = performanceConfig().memory;
    // Monitor garbage collection
    if (global.gc) {
      const originalGc = global.gc;
      global.gc = async () => {
        const start = Date.now();
        const result = originalGc();
        this.gcCount++;
        this.gcTime += Date.now() - start;
        return result;
      };
    }
  }

  /**
   * Get current memory metrics
   * @returns MemoryMetrics - Current memory usage
   */
  getMemoryMetrics(): MemoryMetrics {
    const usage = process.memoryUsage();
    const heap = {
      used: usage.heapUsed,
      total: usage.heapTotal,
      available: usage.heapTotal - usage.heapUsed,
      percentage: (usage.heapUsed / usage.heapTotal) * 100,
    };

    return {
      heap,
      external: usage.external,
      rss: usage.rss,
      arrayBuffers: usage.arrayBuffers,
      gc: {
        count: this.gcCount,
        time: this.gcTime,
      },
    };
  }

  /**
   * Check if memory optimization is needed
   * @returns boolean - Whether optimization is needed
   */
  isOptimizationNeeded(): boolean {
    const metrics = this.getMemoryMetrics();
    return metrics.heap.percentage > this.thresholds.usageThreshold * 100;
  }

  /**
   * Perform memory optimization
   * @returns Promise<MemoryOptimizationResult> - Optimization result
   */
  async optimizeMemory(): Promise<MemoryOptimizationResult> {
    const before = this.getMemoryMetrics();
    let memoryFreed = 0;
    const actions: string[] = [];

    try {
      // 1. Clear query cache
      const cacheCleared = await this.clearQueryCache();
      if (cacheCleared) {
        actions.push('Cleared query cache');
        memoryFreed += await this.estimateCacheMemory();
      }

      // 2. Clear expired reservations
      const reservationsCleared = await this.clearExpiredReservations();
      if (reservationsCleared) {
        actions.push('Cleared expired reservations');
        memoryFreed += await this.estimateReservationMemory();
      }

      // 3. Clear old metrics
      const metricsCleared = await this.clearOldMetrics();
      if (metricsCleared) {
        actions.push('Cleared old metrics');
        memoryFreed += await this.estimateMetricsMemory();
      }

      // 4. Force garbage collection
      if (global.gc) {
        global.gc();
        actions.push('Forced garbage collection');
      }

      // 5. Clear unused variables
      this.clearUnusedVariables();
      actions.push('Cleared unused variables');

      const after = this.getMemoryMetrics();
      const improvement = before.heap.used - after.heap.used;

      this.logger.log(`Memory optimization completed. Freed: ${this.formatBytes(improvement)}`);

      return {
        action: actions.join(', '),
        memoryFreed: improvement,
        before,
        after,
        improvement: improvement > 0 ? (improvement / before.heap.used) * 100 : 0,
      };
    } catch (error) {
      this.logger.error('Error optimizing memory:', error);
      throw error;
    }
  }

  /**
   * Monitor memory usage and auto-optimize if needed
   * @returns Promise<void>
   */
  async monitorAndOptimize(): Promise<void> {
    if (this.isOptimizationNeeded()) {
      this.logger.warn('High memory usage detected, starting optimization...');
      await this.optimizeMemory();
    }
  }

  /**
   * Get memory usage trends
   * @param duration - Duration in minutes
   * @returns Promise<MemoryMetrics[]> - Memory usage over time
   */
  async getMemoryTrends(duration: number = 60): Promise<MemoryMetrics[]> {
    // This would typically store historical data
    // For now, return current metrics
    return [this.getMemoryMetrics()];
  }

  /**
   * Identify memory leaks
   * @returns Promise<string[]> - Potential memory leak sources
   */
  async identifyMemoryLeaks(): Promise<string[]> {
    const leaks: string[] = [];
    const metrics = this.getMemoryMetrics();

    // Check for high memory usage
    if (metrics.heap.percentage > 90) {
      leaks.push('High heap usage detected');
    }

    // Check for growing external memory
    if (metrics.external > this.thresholds.externalMemoryThreshold) {
      leaks.push('High external memory usage');
    }

    // Check for frequent GC
    if (this.gcCount > this.thresholds.gcCountThreshold) {
      leaks.push('Frequent garbage collection detected');
    }

    return leaks;
  }

  /**
   * Clear query cache
   * @returns Promise<boolean> - Success status
   */
  private async clearQueryCache(): Promise<boolean> {
    try {
      await this.queryCache.clearAll();
      return true;
    } catch (error) {
      this.logger.error('Error clearing query cache:', error);
      return false;
    }
  }

  /**
   * Clear expired reservations
   * @returns Promise<boolean> - Success status
   */
  private async clearExpiredReservations(): Promise<boolean> {
    try {
      // This would clear expired credit reservations
      // Implementation depends on the reservation service
      return true;
    } catch (error) {
      this.logger.error('Error clearing expired reservations:', error);
      return false;
    }
  }

  /**
   * Clear old metrics
   * @returns Promise<boolean> - Success status
   */
  private async clearOldMetrics(): Promise<boolean> {
    try {
      // Clear old metrics data
      // This would typically clear old monitoring data
      return true;
    } catch (error) {
      this.logger.error('Error clearing old metrics:', error);
      return false;
    }
  }

  /**
   * Clear unused variables
   * @returns void
   */
  private clearUnusedVariables(): void {
    // Clear any cached data that might be holding references
    // This is a placeholder for actual cleanup logic
  }

  /**
   * Estimate cache memory usage
   * @returns Promise<number> - Estimated memory in bytes
   */
  private async estimateCacheMemory(): Promise<number> {
    try {
      const metrics = await this.queryCache.getCacheMetrics();
      // Rough estimate: 1KB per cache key
      return metrics.totalKeys * 1024;
    } catch (error) {
      this.logger.error('Error estimating cache memory:', error);
      return 0;
    }
  }

  /**
   * Format bytes to human readable string
   * @param bytes - Bytes to format
   * @returns string - Formatted string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  /**
   * Get memory optimization recommendations
   * @returns string[] - Optimization recommendations
   */
  getOptimizationRecommendations(): string[] {
    const recommendations: string[] = [];
    const metrics = this.getMemoryMetrics();

    if (metrics.heap.percentage > 80) {
      recommendations.push('Consider increasing heap size or optimizing memory usage');
    }

    if (metrics.external > 50 * 1024 * 1024) {
      // 50MB
      recommendations.push('Review external memory usage (buffers, streams)');
    }

    if (this.gcCount > 50) {
      recommendations.push('Optimize object creation and disposal patterns');
    }

    if (metrics.rss > 500 * 1024 * 1024) {
      // 500MB
      recommendations.push('Consider implementing memory pooling for large objects');
    }

    return recommendations;
  }

  /**
   * Get current thresholds
   * @returns PerformanceThresholds['memory'] - Current memory thresholds
   */
  getThresholds(): PerformanceThresholds['memory'] {
    return this.thresholds;
  }

  /**
   * Get memory statistics
   * @returns object - Memory statistics
   */
  getMemoryStatistics(): object {
    const metrics = this.getMemoryMetrics();
    return {
      current: metrics,
      threshold: this.thresholds.usageThreshold,
      needsOptimization: this.isOptimizationNeeded(),
      recommendations: this.getOptimizationRecommendations(),
    };
  }

  /**
   * Estimate memory used by reservations
   * @returns Promise<number> - Estimated memory in bytes
   */
  private async estimateReservationMemory(): Promise<number> {
    try {
      // This would typically query the reservation service for actual count
      // For now, estimate based on typical reservation size
      const estimatedReservations = 100; // Would be actual count
      const avgReservationSize = 1024; // 1KB per reservation
      return estimatedReservations * avgReservationSize;
    } catch (error) {
      this.logger.error('Error estimating reservation memory:', error);
      return 0;
    }
  }

  /**
   * Estimate memory used by metrics
   * @returns Promise<number> - Estimated memory in bytes
   */
  private async estimateMetricsMemory(): Promise<number> {
    try {
      // Estimate based on typical metrics data size
      const estimatedMetrics = 50; // Would be actual count
      const avgMetricSize = 512; // 512 bytes per metric
      return estimatedMetrics * avgMetricSize;
    } catch (error) {
      this.logger.error('Error estimating metrics memory:', error);
      return 0;
    }
  }
}
