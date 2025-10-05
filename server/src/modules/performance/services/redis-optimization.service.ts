import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { performanceConfig, PerformanceThresholds } from '../config/performance.config';

export interface RedisMetrics {
  memory: {
    used: number;
    peak: number;
    fragmentation: number;
  };
  connections: {
    total: number;
    active: number;
    idle: number;
  };
  operations: {
    total: number;
    perSecond: number;
    slowLog: number;
  };
  keys: {
    total: number;
    expired: number;
    evicted: number;
  };
  performance: {
    hitRate: number;
    missRate: number;
    averageLatency: number;
  };
}

export interface RedisOptimizationResult {
  action: string;
  keysRemoved: number;
  memoryFreed: number;
  latencyImproved: number;
  before: RedisMetrics;
  after: RedisMetrics;
}

/**
 * Redis optimization service
 * Provides Redis performance monitoring and optimization
 */
@Injectable()
export class RedisOptimizationService {
  private readonly logger = new Logger(RedisOptimizationService.name);
  private operationCount = 0;
  private operationStartTime = Date.now();
  private readonly thresholds: PerformanceThresholds['redis'];

  constructor(@InjectRedis() private readonly redis: Redis) {
    this.thresholds = performanceConfig().redis;
  }

  /**
   * Get Redis performance metrics
   * @returns Promise<RedisMetrics> - Redis metrics
   */
  async getRedisMetrics(): Promise<RedisMetrics> {
    try {
      const info = await this.redis.info();
      const parsed = this.parseRedisInfo(info);

      // Calculate operations per second
      const now = Date.now();
      const timeDiff = (now - this.operationStartTime) / 1000;
      const opsPerSecond = timeDiff > 0 ? this.operationCount / timeDiff : 0;

      return {
        memory: {
          used: parsed.used_memory || 0,
          peak: parsed.used_memory_peak || 0,
          fragmentation: parsed.mem_fragmentation_ratio || 0,
        },
        connections: {
          total: parsed.total_connections_received || 0,
          active: parsed.connected_clients || 0,
          idle: parsed.connected_clients || 0,
        },
        operations: {
          total: parsed.total_commands_processed || 0,
          perSecond: opsPerSecond,
          slowLog: parsed.slowlog_len || 0,
        },
        keys: {
          total: parsed.db0?.keys || 0,
          expired: parsed.expired_keys || 0,
          evicted: parsed.evicted_keys || 0,
        },
        performance: {
          hitRate: this.calculateHitRate(parsed),
          missRate: 1 - this.calculateHitRate(parsed),
          averageLatency: await this.getAverageLatency(),
        },
      };
    } catch (error) {
      this.logger.error('Error getting Redis metrics:', error);
      throw error;
    }
  }

  /**
   * Optimize Redis performance
   * @returns Promise<RedisOptimizationResult> - Optimization result
   */
  async optimizeRedis(): Promise<RedisOptimizationResult> {
    const before = await this.getRedisMetrics();
    let keysRemoved = 0;
    let memoryFreed = 0;
    const actions: string[] = [];

    try {
      // 1. Clear expired keys
      const expiredCleared = await this.clearExpiredKeys();
      if (expiredCleared > 0) {
        keysRemoved += expiredCleared;
        actions.push(`Cleared ${expiredCleared} expired keys`);
      }

      // 2. Optimize memory usage
      const memoryOptimized = await this.optimizeMemoryUsage();
      if (memoryOptimized > 0) {
        memoryFreed += memoryOptimized;
        actions.push(`Optimized memory usage`);
      }

      // 3. Clear slow log
      const slowLogCleared = await this.clearSlowLog();
      if (slowLogCleared) {
        actions.push('Cleared slow log');
      }

      // 4. Optimize key patterns
      const patternOptimized = await this.optimizeKeyPatterns();
      if (patternOptimized > 0) {
        keysRemoved += patternOptimized;
        actions.push(`Optimized ${patternOptimized} key patterns`);
      }

      // 5. Configure Redis for better performance
      await this.configureRedisPerformance();
      actions.push('Configured Redis for better performance');

      const after = await this.getRedisMetrics();
      const latencyImproved = before.performance.averageLatency - after.performance.averageLatency;

      this.logger.log(`Redis optimization completed. Keys removed: ${keysRemoved}, Memory freed: ${this.formatBytes(memoryFreed)}`);

      return {
        action: actions.join(', '),
        keysRemoved,
        memoryFreed,
        latencyImproved,
        before,
        after,
      };
    } catch (error) {
      this.logger.error('Error optimizing Redis:', error);
      throw error;
    }
  }

  /**
   * Monitor Redis performance and auto-optimize if needed
   * @returns Promise<void>
   */
  async monitorAndOptimize(): Promise<void> {
    const metrics = await this.getRedisMetrics();
    
    // Check if optimization is needed
    const needsOptimization = 
      metrics.memory.fragmentation > this.thresholds.fragmentationThreshold ||
      metrics.performance.averageLatency > this.thresholds.latencyThreshold ||
      metrics.operations.slowLog > this.thresholds.maxSlowOperations;

    if (needsOptimization) {
      this.logger.warn('Redis performance issues detected, starting optimization...');
      await this.optimizeRedis();
    }
  }

  /**
   * Get Redis optimization recommendations
   * @returns Promise<string[]> - Optimization recommendations
   */
  async getOptimizationRecommendations(): Promise<string[]> {
    const recommendations: string[] = [];
    const metrics = await this.getRedisMetrics();

    if (metrics.memory.fragmentation > this.thresholds.fragmentationThreshold) {
      recommendations.push('High memory fragmentation detected. Consider restarting Redis or using memory defragmentation');
    }

    if (metrics.performance.averageLatency > this.thresholds.latencyThreshold) {
      recommendations.push('High latency detected. Consider optimizing queries or increasing Redis memory');
    }

    if (metrics.operations.slowLog > this.thresholds.maxSlowOperations) {
      recommendations.push('Many slow operations detected. Review and optimize slow queries');
    }

    if (metrics.keys.total > 100000) {
      recommendations.push('Large number of keys detected. Consider implementing key expiration strategies');
    }

    if (metrics.performance.hitRate < this.thresholds.hitRateThreshold) {
      recommendations.push('Low cache hit rate. Consider optimizing cache key patterns');
    }

    return recommendations;
  }

  /**
   * Clear expired keys
   * @returns Promise<number> - Number of keys cleared
   */
  private async clearExpiredKeys(): Promise<number> {
    try {
      // Redis automatically removes expired keys, but we can trigger cleanup
      await this.redis.eval('return redis.call("MEMORY", "PURGE")', 0);
      return 0; // Redis doesn't return count of expired keys
    } catch (error) {
      this.logger.error('Error clearing expired keys:', error);
      return 0;
    }
  }

  /**
   * Optimize memory usage
   * @returns Promise<number> - Memory freed in bytes
   */
  private async optimizeMemoryUsage(): Promise<number> {
    try {
      // Get memory info before optimization
      const infoBefore = await this.redis.info('memory');
      const beforeMatch = infoBefore.match(/used_memory:(\d+)/);
      const before = beforeMatch ? parseInt(beforeMatch[1], 10) : 0;
      
      // Trigger memory optimization
      await this.redis.eval('return redis.call("MEMORY", "PURGE")', 0);
      
      // Get memory info after optimization
      const infoAfter = await this.redis.info('memory');
      const afterMatch = infoAfter.match(/used_memory:(\d+)/);
      const after = afterMatch ? parseInt(afterMatch[1], 10) : 0;
      
      return before - after;
    } catch (error) {
      this.logger.error('Error optimizing memory usage:', error);
      return 0;
    }
  }

  /**
   * Clear slow log
   * @returns Promise<boolean> - Success status
   */
  private async clearSlowLog(): Promise<boolean> {
    try {
      await this.redis.slowlog('RESET');
      return true;
    } catch (error) {
      this.logger.error('Error clearing slow log:', error);
      return false;
    }
  }

  /**
   * Optimize key patterns
   * @returns Promise<number> - Number of keys optimized
   */
  private async optimizeKeyPatterns(): Promise<number> {
    try {
      let optimized = 0;

      // Find and optimize common patterns
      const patterns = [
        'query_cache:*',
        'rate_limit:*',
        'session:*',
        'temp:*',
      ];

      for (const pattern of patterns) {
        const keys = await this.redis.keys(pattern);
        if (keys.length > 1000) { // Only optimize if there are many keys
          // Set expiration for temporary keys
          for (const key of keys.slice(0, 100)) { // Limit to 100 keys per pattern
            const ttl = await this.redis.ttl(key);
            if (ttl === -1) { // No expiration set
              await this.redis.expire(key, 3600); // Set 1 hour expiration
              optimized++;
            }
          }
        }
      }

      return optimized;
    } catch (error) {
      this.logger.error('Error optimizing key patterns:', error);
      return 0;
    }
  }

  /**
   * Configure Redis for better performance
   * @returns Promise<void>
   */
  private async configureRedisPerformance(): Promise<void> {
    try {
      // Configure Redis settings for better performance
      const configs = [
        ['maxmemory-policy', 'allkeys-lru'],
        ['tcp-keepalive', '60'],
        ['timeout', '300'],
        ['tcp-backlog', '511'],
      ];

      for (const [key, value] of configs) {
        try {
          await this.redis.config('SET', key, value);
        } catch (error) {
          this.logger.warn(`Failed to set Redis config ${key}=${value}:`, error.message);
        }
      }
    } catch (error) {
      this.logger.error('Error configuring Redis performance:', error);
    }
  }

  /**
   * Get average latency
   * @returns Promise<number> - Average latency in milliseconds
   */
  private async getAverageLatency(): Promise<number> {
    try {
      const start = Date.now();
      await this.redis.ping();
      return Date.now() - start;
    } catch (error) {
      this.logger.error('Error measuring latency:', error);
      return 0;
    }
  }

  /**
   * Calculate hit rate from Redis info
   * @param parsed - Parsed Redis info
   * @returns number - Hit rate (0-1)
   */
  private calculateHitRate(parsed: any): number {
    const hits = parsed.keyspace_hits || 0;
    const misses = parsed.keyspace_misses || 0;
    const total = hits + misses;
    return total > 0 ? hits / total : 0;
  }

  /**
   * Parse Redis info string
   * @param info - Redis info string
   * @returns any - Parsed info object
   */
  private parseRedisInfo(info: string): any {
    const parsed: any = {};
    const lines = info.split('\r\n');
    
    for (const line of lines) {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        parsed[key] = isNaN(Number(value)) ? value : Number(value);
      }
    }

    // Parse database info
    const dbMatch = info.match(/db0:keys=(\d+),expires=(\d+)/);
    if (dbMatch) {
      parsed.db0 = {
        keys: parseInt(dbMatch[1], 10),
        expires: parseInt(dbMatch[2], 10),
      };
    }

    return parsed;
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
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Get Redis statistics
   * @returns Promise<object> - Redis statistics
   */
  async getRedisStatistics(): Promise<object> {
    const metrics = await this.getRedisMetrics();
    const recommendations = await this.getOptimizationRecommendations();
    
    return {
      metrics,
      recommendations,
      needsOptimization: recommendations.length > 0,
    };
  }
}
