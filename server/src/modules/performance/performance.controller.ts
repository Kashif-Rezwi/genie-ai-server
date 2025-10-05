import { Controller, Get, Post, UseGuards, HttpCode, HttpStatus, Param } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../../common/guards/admin-role.guard';
import { PerformanceService } from './services/performance.service';
import { QueryCacheService } from './services/query-cache.service';
import { BackgroundJobService } from './services/background-job.service';
import { DatabaseOptimizationService } from './services/database-optimization.service';
import { MemoryOptimizationService } from './services/memory-optimization.service';
import { RedisOptimizationService } from './services/redis-optimization.service';
import { PerformanceMonitoringService } from './services/performance-monitoring.service';

/**
 * Performance monitoring and optimization controller
 * Provides endpoints for performance metrics and optimization
 */
@Controller('api/performance')
@UseGuards(JwtAuthGuard)
export class PerformanceController {
  constructor(
    private readonly performanceService: PerformanceService,
    private readonly queryCache: QueryCacheService,
    private readonly backgroundJobs: BackgroundJobService,
    private readonly databaseOptimization: DatabaseOptimizationService,
    private readonly memoryOptimization: MemoryOptimizationService,
    private readonly redisOptimization: RedisOptimizationService,
    private readonly performanceMonitoring: PerformanceMonitoringService,
  ) {}

  /**
   * Get comprehensive performance metrics
   * @returns Promise<object> - Performance metrics
   */
  @Get('metrics')
  async getMetrics() {
    return this.performanceService.getPerformanceMetrics();
  }

  /**
   * Get cache statistics
   * @returns Promise<object> - Cache statistics
   */
  @Get('cache/stats')
  async getCacheStats() {
    return this.queryCache.getStats();
  }

  /**
   * Clear all caches
   * @returns Promise<object> - Clear results
   */
  @Post('cache/clear')
  @HttpCode(HttpStatus.OK)
  async clearCache() {
    const cleared = await this.queryCache.clear();
    return {
      success: true,
      clearedKeys: cleared,
      message: `Cleared ${cleared} cache entries`,
    };
  }

  /**
   * Invalidate cache by pattern
   * @param pattern - Cache pattern to invalidate
   * @returns Promise<object> - Invalidation results
   */
  @Post('cache/invalidate')
  @HttpCode(HttpStatus.OK)
  async invalidateCache(pattern: string) {
    const cleared = await this.queryCache.invalidate(pattern);
    return {
      success: true,
      clearedKeys: cleared,
      message: `Invalidated ${cleared} cache entries matching pattern: ${pattern}`,
    };
  }

  /**
   * Get background job statistics
   * @returns Promise<object> - Job statistics
   */
  @Get('jobs/stats')
  async getJobStats() {
    return this.backgroundJobs.getJobStats();
  }

  /**
   * Get job status by ID
   * @param jobId - Job ID
   * @returns Promise<object> - Job status
   */
  @Get('jobs/:jobId')
  async getJobStatus(jobId: string) {
    const job = await this.backgroundJobs.getJobStatus(jobId);
    if (!job) {
      return {
        success: false,
        message: 'Job not found',
      };
    }
    return {
      success: true,
      job,
    };
  }

  /**
   * Optimize system performance (Admin only)
   * @returns Promise<object> - Optimization results
   */
  @Post('optimize')
  @UseGuards(AdminRoleGuard)
  @HttpCode(HttpStatus.OK)
  async optimizePerformance() {
    const results = await this.performanceMonitoring.optimizePerformance();
    return {
      success: true,
      results,
      message: 'Performance optimization completed',
    };
  }

  /**
   * Perform basic system cleanup (Admin only) - Legacy method
   * @returns Promise<object> - Cleanup results
   */
  @Post('cleanup')
  @UseGuards(AdminRoleGuard)
  @HttpCode(HttpStatus.OK)
  async performBasicCleanup() {
    const results = await this.performanceService.performBasicCleanup();
    return {
      success: true,
      results,
      message: 'Basic system cleanup completed',
    };
  }

  /**
   * Get comprehensive performance report (Admin only)
   * @returns Promise<object> - Performance report
   */
  @Get('report')
  @UseGuards(AdminRoleGuard)
  async getPerformanceReport() {
    return this.performanceMonitoring.generatePerformanceReport();
  }

  /**
   * Get database optimization metrics (Admin only)
   * @returns Promise<object> - Database metrics
   */
  @Get('database/metrics')
  @UseGuards(AdminRoleGuard)
  async getDatabaseMetrics() {
    return this.databaseOptimization.getDatabaseMetrics();
  }

  /**
   * Optimize database (Admin only)
   * @returns Promise<object> - Database optimization results
   */
  @Post('database/optimize')
  @UseGuards(AdminRoleGuard)
  @HttpCode(HttpStatus.OK)
  async optimizeDatabase() {
    const results = await this.databaseOptimization.optimizeIndexes();
    return {
      success: true,
      optimizations: results,
      message: 'Database optimization completed',
    };
  }

  /**
   * Get memory optimization metrics (Admin only)
   * @returns Promise<object> - Memory metrics
   */
  @Get('memory/metrics')
  @UseGuards(AdminRoleGuard)
  async getMemoryMetrics() {
    return this.memoryOptimization.getMemoryMetrics();
  }

  /**
   * Optimize memory (Admin only)
   * @returns Promise<object> - Memory optimization results
   */
  @Post('memory/optimize')
  @UseGuards(AdminRoleGuard)
  @HttpCode(HttpStatus.OK)
  async optimizeMemory() {
    const results = await this.memoryOptimization.optimizeMemory();
    return {
      success: true,
      results,
      message: 'Memory optimization completed',
    };
  }

  /**
   * Get Redis optimization metrics (Admin only)
   * @returns Promise<object> - Redis metrics
   */
  @Get('redis/metrics')
  @UseGuards(AdminRoleGuard)
  async getRedisMetrics() {
    return this.redisOptimization.getRedisMetrics();
  }

  /**
   * Optimize Redis (Admin only)
   * @returns Promise<object> - Redis optimization results
   */
  @Post('redis/optimize')
  @UseGuards(AdminRoleGuard)
  @HttpCode(HttpStatus.OK)
  async optimizeRedis() {
    const results = await this.redisOptimization.optimizeRedis();
    return {
      success: true,
      results,
      message: 'Redis optimization completed',
    };
  }

  /**
   * Get performance alerts (Admin only)
   * @returns Promise<object> - Performance alerts
   */
  @Get('alerts')
  @UseGuards(AdminRoleGuard)
  async getPerformanceAlerts() {
    return this.performanceMonitoring.getAlerts();
  }

  /**
   * Resolve performance alert (Admin only)
   * @param alertId - Alert ID
   * @returns Promise<object> - Resolution result
   */
  @Post('alerts/:alertId/resolve')
  @UseGuards(AdminRoleGuard)
  @HttpCode(HttpStatus.OK)
  async resolveAlert(@Param('alertId') alertId: string) {
    const resolved = await this.performanceMonitoring.resolveAlert(alertId);
    return {
      success: resolved,
      message: resolved ? 'Alert resolved' : 'Alert not found',
    };
  }

  /**
   * Get system health status
   * @returns Promise<object> - Health status
   */
  @Get('health')
  async getHealthStatus() {
    const metrics = await this.performanceService.getPerformanceMetrics();
    
    // Determine health status based on metrics
    const isHealthy = 
      metrics.system.memoryUsage.heapUsed < 500 * 1024 * 1024 && // Less than 500MB
      metrics.jobs.failed < 10 && // Less than 10 failed jobs
      metrics.cache.totalKeys < 10000; // Less than 10k cache keys

    return {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      metrics: {
        memoryUsage: this.formatBytes(metrics.system.memoryUsage.heapUsed),
        cacheKeys: metrics.cache.totalKeys,
        failedJobs: metrics.jobs.failed,
      },
    };
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
