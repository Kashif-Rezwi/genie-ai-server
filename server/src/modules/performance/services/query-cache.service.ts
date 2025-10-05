import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  keyPrefix?: string;
  serialize?: boolean; // Whether to serialize/deserialize data
}

export interface CacheResult<T> {
  data: T;
  fromCache: boolean;
  ttl?: number;
}

/**
 * High-performance query caching service using Redis
 * Provides intelligent caching with TTL, serialization, and cache invalidation
 */
@Injectable()
export class QueryCacheService {
  private readonly logger = new Logger(QueryCacheService.name);
  private readonly defaultTtl = 300; // 5 minutes default
  private readonly keyPrefix = 'query_cache:';
  
  // Performance metrics
  private cacheHits = 0;
  private cacheMisses = 0;
  private totalLatency = 0;

  constructor(@InjectRedis() private readonly redis: Redis) {}

  /**
   * Get data from cache or execute function and cache result
   * @param key - Cache key
   * @param fetcher - Function to fetch data if not in cache
   * @param options - Cache options
   * @returns Promise<CacheResult<T>> - Cached or fresh data
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<CacheResult<T>> {
    const startTime = Date.now();
    const cacheKey = this.buildKey(key, options.keyPrefix);
    const ttl = options.ttl ?? this.defaultTtl;

    try {
      // Try to get from cache first
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        this.cacheHits++;
        const data = options.serialize !== false ? JSON.parse(cached) : cached;
        const latency = Date.now() - startTime;
        this.totalLatency += latency;
        
        return {
          data: data as T,
          fromCache: true,
          ttl: await this.redis.ttl(cacheKey),
        };
      }

      // Cache miss - fetch data
      this.cacheMisses++;
      const data = await fetcher();
      
      // Cache the result
      const serialized = options.serialize !== false ? JSON.stringify(data) : String(data);
      await this.redis.setex(cacheKey, ttl, serialized);

      const latency = Date.now() - startTime;
      this.totalLatency += latency;

      return {
        data,
        fromCache: false,
        ttl,
      };
    } catch (error) {
      this.logger.warn(`Cache operation failed for key ${cacheKey}:`, error);
      
      // Fallback to direct fetch
      const data = await fetcher();
      const latency = Date.now() - startTime;
      this.totalLatency += latency;
      
      return {
        data,
        fromCache: false,
      };
    }
  }

  /**
   * Get data from cache only (no fallback)
   * @param key - Cache key
   * @param options - Cache options
   * @returns Promise<T | null> - Cached data or null
   */
  async get<T>(key: string, options: CacheOptions = {}): Promise<T | null> {
    const cacheKey = this.buildKey(key, options.keyPrefix);

    try {
      const cached = await this.redis.get(cacheKey);
      if (!cached) return null;

      return options.serialize !== false ? JSON.parse(cached) : (cached as T);
    } catch (error) {
      this.logger.warn(`Cache get failed for key ${cacheKey}:`, error);
      return null;
    }
  }

  /**
   * Set data in cache
   * @param key - Cache key
   * @param data - Data to cache
   * @param options - Cache options
   * @returns Promise<boolean> - Success status
   */
  async set<T>(key: string, data: T, options: CacheOptions = {}): Promise<boolean> {
    const cacheKey = this.buildKey(key, options.keyPrefix);
    const ttl = options.ttl ?? this.defaultTtl;

    try {
      const serialized = options.serialize !== false ? JSON.stringify(data) : String(data);
      await this.redis.setex(cacheKey, ttl, serialized);
      return true;
    } catch (error) {
      this.logger.warn(`Cache set failed for key ${cacheKey}:`, error);
      return false;
    }
  }

  /**
   * Invalidate cache by key pattern
   * @param pattern - Key pattern to invalidate
   * @returns Promise<number> - Number of keys deleted
   */
  async invalidate(pattern: string): Promise<number> {
    try {
      const keys = await this.redis.keys(this.buildKey(pattern));
      if (keys.length === 0) return 0;

      return await this.redis.del(...keys);
    } catch (error) {
      this.logger.warn(`Cache invalidation failed for pattern ${pattern}:`, error);
      return 0;
    }
  }

  /**
   * Invalidate cache by exact key
   * @param key - Exact key to invalidate
   * @returns Promise<boolean> - Success status
   */
  async invalidateKey(key: string, keyPrefix?: string): Promise<boolean> {
    const cacheKey = this.buildKey(key, keyPrefix);
    
    try {
      const result = await this.redis.del(cacheKey);
      return result > 0;
    } catch (error) {
      this.logger.warn(`Cache key invalidation failed for key ${cacheKey}:`, error);
      return false;
    }
  }

  /**
   * Get cache statistics
   * @returns Promise<object> - Cache statistics
   */
  async getStats(): Promise<{
    totalKeys: number;
    memoryUsage: string;
    hitRate: number;
    hitCount: number;
    missCount: number;
    averageLatency: number;
  }> {
    try {
      const info = await this.redis.info('memory');
      const keys = await this.redis.keys(this.buildKey('*'));
      
      const totalRequests = this.cacheHits + this.cacheMisses;
      const hitRate = totalRequests > 0 ? this.cacheHits / totalRequests : 0;
      const averageLatency = totalRequests > 0 ? this.totalLatency / totalRequests : 0;
      
      return {
        totalKeys: keys.length,
        memoryUsage: this.extractMemoryUsage(info),
        hitRate,
        hitCount: this.cacheHits,
        missCount: this.cacheMisses,
        averageLatency,
      };
    } catch (error) {
      this.logger.warn('Failed to get cache stats:', error);
      return {
        totalKeys: 0,
        memoryUsage: 'Unknown',
        hitRate: 0,
        hitCount: 0,
        missCount: 0,
        averageLatency: 0,
      };
    }
  }

  /**
   * Get cache performance metrics
   * @returns Promise<object> - Cache metrics
   */
  async getCacheMetrics(): Promise<{
    hitRate: number;
    totalKeys: number;
    memoryUsage: string;
    hitCount: number;
    missCount: number;
    averageLatency: number;
  }> {
    return this.getStats();
  }

  /**
   * Update cache configuration
   * @param config - New configuration
   * @returns Promise<void>
   */
  async updateConfig(config: { defaultTtl?: number }): Promise<void> {
    if (config.defaultTtl) {
      (this as any).defaultTtl = config.defaultTtl;
    }
  }

  /**
   * Clear all cache entries
   * @returns Promise<boolean> - Success status
   */
  async clearAll(): Promise<boolean> {
    try {
      const keys = await this.redis.keys(this.buildKey('*'));
      if (keys.length === 0) return true;

      await this.redis.del(...keys);
      this.logger.log(`Cleared ${keys.length} cache entries`);
      return true;
    } catch (error) {
      this.logger.error('Failed to clear cache:', error);
      return false;
    }
  }

  /**
   * Clear all cache entries
   * @returns Promise<number> - Number of keys deleted
   */
  async clear(): Promise<number> {
    try {
      const keys = await this.redis.keys(this.buildKey('*'));
      if (keys.length === 0) return 0;

      return await this.redis.del(...keys);
    } catch (error) {
      this.logger.warn('Cache clear failed:', error);
      return 0;
    }
  }

  /**
   * Build cache key with prefix
   * @param key - Base key
   * @param keyPrefix - Optional custom prefix
   * @returns string - Full cache key
   */
  private buildKey(key: string, keyPrefix?: string): string {
    const prefix = keyPrefix ?? this.keyPrefix;
    return `${prefix}${key}`;
  }

  /**
   * Extract memory usage from Redis info
   * @param info - Redis info string
   * @returns string - Memory usage
   */
  private extractMemoryUsage(info: string): string {
    const match = info.match(/used_memory_human:([^\r\n]+)/);
    return match ? match[1].trim() : 'Unknown';
  }
}
