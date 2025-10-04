import { Injectable, Logger } from '@nestjs/common';
import { QueryCacheService } from './query-cache.service';
import { BackgroundJobService } from './background-job.service';
import { OptimizedCreditReservationService } from './optimized-credit-reservation.service';

export interface PerformanceMetrics {
  cache: {
    hitRate: number;
    totalKeys: number;
    memoryUsage: string;
  };
  jobs: {
    pending: number;
    completed: number;
    failed: number;
    total: number;
  };
  reservations: {
    totalReserved: number;
    activeReservations: number;
    expiredReservations: number;
  };
  system: {
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
  };
}

/**
 * Performance monitoring and optimization service
 * Provides comprehensive performance metrics and optimization tools
 */
@Injectable()
export class PerformanceService {
  private readonly logger = new Logger(PerformanceService.name);
  private startTime = Date.now();
  private lastCpuUsage = process.cpuUsage();

  constructor(
    private readonly queryCache: QueryCacheService,
    private readonly backgroundJobs: BackgroundJobService,
    private readonly creditReservations: OptimizedCreditReservationService,
  ) {}

  /**
   * Get comprehensive performance metrics
   * @returns Promise<PerformanceMetrics> - Performance metrics
   */
  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    try {
      const [cacheStats, jobStats, systemMetrics] = await Promise.all([
        this.getCacheMetrics(),
        this.backgroundJobs.getJobStats(),
        this.getSystemMetrics(),
      ]);

      // Get reservation stats for a sample user (in real app, you'd aggregate this)
      const reservationStats = {
        totalReserved: 0,
        activeReservations: 0,
        expiredReservations: 0,
      };

      return {
        cache: cacheStats,
        jobs: jobStats,
        reservations: reservationStats,
        system: systemMetrics,
      };
    } catch (error) {
      this.logger.error('Failed to get performance metrics:', error);
      throw error;
    }
  }

  /**
   * Optimize system performance
   * @returns Promise<object> - Optimization results
   */
  async optimizePerformance(): Promise<{
    cacheCleared: boolean;
    expiredJobsCleaned: number;
    expiredReservationsCleaned: number;
    memoryFreed: string;
  }> {
    try {
      const [cacheCleared, expiredReservationsCleaned] = await Promise.all([
        this.clearCache(),
        this.creditReservations.cleanupExpiredReservations(),
      ]);

      // Clean up old jobs
      await this.backgroundJobs.cleanupOldJobs();

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const memoryUsage = process.memoryUsage();
      const memoryFreed = this.formatBytes(memoryUsage.heapUsed);

      this.logger.log('Performance optimization completed');

      return {
        cacheCleared,
        expiredJobsCleaned: 0, // Would need to track this
        expiredReservationsCleaned,
        memoryFreed,
      };
    } catch (error) {
      this.logger.error('Failed to optimize performance:', error);
      throw error;
    }
  }

  /**
   * Get cache performance metrics
   * @returns Promise<object> - Cache metrics
   */
  private async getCacheMetrics(): Promise<{
    hitRate: number;
    totalKeys: number;
    memoryUsage: string;
  }> {
    try {
      const stats = await this.queryCache.getStats();
      return {
        hitRate: 0, // Would need to track hits/misses
        totalKeys: stats.totalKeys,
        memoryUsage: stats.memoryUsage,
      };
    } catch (error) {
      this.logger.warn('Failed to get cache metrics:', error);
      return {
        hitRate: 0,
        totalKeys: 0,
        memoryUsage: 'Unknown',
      };
    }
  }

  /**
   * Get system performance metrics
   * @returns Promise<object> - System metrics
   */
  private getSystemMetrics(): {
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
  } {
    const currentCpuUsage = process.cpuUsage(this.lastCpuUsage);
    this.lastCpuUsage = process.cpuUsage();

    return {
      uptime: Date.now() - this.startTime,
      memoryUsage: process.memoryUsage(),
      cpuUsage: currentCpuUsage,
    };
  }

  /**
   * Clear all caches
   * @returns Promise<boolean> - Success status
   */
  private async clearCache(): Promise<boolean> {
    try {
      const cleared = await this.queryCache.clear();
      this.logger.log(`Cleared ${cleared} cache entries`);
      return cleared > 0;
    } catch (error) {
      this.logger.warn('Failed to clear cache:', error);
      return false;
    }
  }

  /**
   * Format bytes to human readable string
   * @param bytes - Number of bytes
   * @returns string - Formatted string
   */
  private formatBytes(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }
}
