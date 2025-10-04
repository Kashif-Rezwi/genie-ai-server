import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { redisConfig } from '../../config';

export interface CacheOptions {
    ttl?: number; // Time to live in seconds
    tags?: string[]; // Cache tags for invalidation
    compress?: boolean; // Whether to compress the value
    namespace?: string; // Cache namespace
}

export interface CacheStats {
    hits: number;
    misses: number;
    sets: number;
    deletes: number;
    hitRate: number;
}

@Injectable()
export class RedisService {
    private readonly logger = new Logger(RedisService.name);
    private readonly client: Redis;
    private readonly subscriber: Redis;
    private readonly publisher: Redis;

    constructor() {
        const config = redisConfig();

        this.client = new Redis(config);
        this.subscriber = new Redis(config);
        this.publisher = new Redis(config);

        this.client.on('error', err => {
            this.logger.error('Redis Client Error:', err);
        });

        this.client.on('connect', () => {
            this.logger.log('✅ Redis connected successfully');
        });
    }

    getClient(): Redis {
        return this.client;
    }

    getSubscriber(): Redis {
        return this.subscriber;
    }

    getPublisher(): Redis {
        return this.publisher;
    }

    async get(key: string): Promise<string | null> {
        try {
            return await this.client.get(key);
        } catch (error) {
            this.logger.error('Redis GET error:', error);
            return null;
        }
    }

    async set(key: string, value: string, ttl?: number): Promise<'OK'> {
        try {
            if (ttl) {
                return await this.client.setex(key, ttl, value);
            }
            return await this.client.set(key, value);
        } catch (error) {
            this.logger.error('Redis SET error:', error);
            throw error;
        }
    }

    async del(key: string): Promise<number> {
        return this.client.del(key);
    }

    async exists(key: string): Promise<number> {
        return this.client.exists(key);
    }

    async incr(key: string): Promise<number> {
        return this.client.incr(key);
    }

    async expire(key: string, seconds: number): Promise<number> {
        return this.client.expire(key, seconds);
    }

    async hget(key: string, field: string): Promise<string | null> {
        return this.client.hget(key, field);
    }

    async hset(key: string, field: string, value: string): Promise<number> {
        return this.client.hset(key, field, value);
    }

    async hgetall(key: string): Promise<Record<string, string>> {
        return this.client.hgetall(key);
    }

    async zadd(key: string, score: number, member: string): Promise<number> {
        return this.client.zadd(key, score, member);
    }

    async zcount(key: string, min: string, max: string): Promise<number> {
        return this.client.zcount(key, min, max);
    }

    async zremrangebyscore(key: string, min: string, max: string): Promise<number> {
        return this.client.zremrangebyscore(key, min, max);
    }

    async keys(pattern: string): Promise<string[]> {
        return this.client.keys(pattern);
    }

    // Advanced caching methods
    async getOrSet<T>(
        key: string,
        fetchFn: () => Promise<T>,
        ttl: number = 300,
        serializer?: (value: T) => string,
        deserializer?: (value: string) => T,
    ): Promise<T> {
        try {
            const cached = await this.get(key);
            if (cached) {
                return deserializer ? deserializer(cached) : JSON.parse(cached);
            }

            const data = await fetchFn();
            const serialized = serializer ? serializer(data) : JSON.stringify(data);
            await this.set(key, serialized, ttl);
            return data;
        } catch (error) {
            this.logger.error('Redis getOrSet error:', error);
            // Fallback to direct fetch if Redis fails
            return await fetchFn();
        }
    }

    async invalidatePattern(pattern: string): Promise<number> {
        try {
            const keys = await this.client.keys(pattern);
            if (keys.length === 0) return 0;
            return await this.client.del(...keys);
        } catch (error) {
            this.logger.error('Redis invalidatePattern error:', error);
            return 0;
        }
    }

    async getMultiple(keys: string[]): Promise<(string | null)[]> {
        try {
            return await this.client.mget(...keys);
        } catch (error) {
            this.logger.error('Redis getMultiple error:', error);
            return keys.map(() => null);
        }
    }

    async setMultiple(
        keyValuePairs: Array<{ key: string; value: string; ttl?: number }>,
    ): Promise<void> {
        try {
            const pipeline = this.client.pipeline();
            keyValuePairs.forEach(({ key, value, ttl }) => {
                if (ttl) {
                    pipeline.setex(key, ttl, value);
                } else {
                    pipeline.set(key, value);
                }
            });
            await pipeline.exec();
        } catch (error) {
            this.logger.error('Redis setMultiple error:', error);
            throw error;
        }
    }

    // Enhanced caching methods
    private stats: CacheStats = {
        hits: 0,
        misses: 0,
        sets: 0,
        deletes: 0,
        hitRate: 0,
    };

    async cacheGet<T>(key: string, options?: CacheOptions): Promise<T | null> {
        try {
            const fullKey = this.buildKey(key, options?.namespace);
            const value = await this.client.get(fullKey);

            if (value === null) {
                this.stats.misses++;
                this.updateHitRate();
                return null;
            }

            this.stats.hits++;
            this.updateHitRate();

            // Handle compressed values
            if (options?.compress) {
                return JSON.parse(value);
            }

            return JSON.parse(value);
        } catch (error) {
            this.logger.error('Cache GET error:', error);
            this.stats.misses++;
            this.updateHitRate();
            return null;
        }
    }

    async cacheSet<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
        try {
            const fullKey = this.buildKey(key, options?.namespace);
            const serializedValue = JSON.stringify(value);

            if (options?.ttl) {
                await this.client.setex(fullKey, options.ttl, serializedValue);
            } else {
                await this.client.set(fullKey, serializedValue);
            }

            // Store cache tags for invalidation
            if (options?.tags && options.tags.length > 0) {
                await this.storeCacheTags(fullKey, options.tags);
            }

            this.stats.sets++;
        } catch (error) {
            this.logger.error('Cache SET error:', error);
            throw error;
        }
    }

    async cacheDel(key: string, options?: CacheOptions): Promise<void> {
        try {
            const fullKey = this.buildKey(key, options?.namespace);
            await this.client.del(fullKey);

            // Remove from tag indexes
            await this.removeFromTagIndexes(fullKey);

            this.stats.deletes++;
        } catch (error) {
            this.logger.error('Cache DEL error:', error);
            throw error;
        }
    }

    async cacheInvalidateByTag(tag: string): Promise<number> {
        try {
            const tagKey = `tag:${tag}`;
            const keys = await this.client.smembers(tagKey);

            if (keys.length === 0) {
                return 0;
            }

            const pipeline = this.client.pipeline();
            keys.forEach(key => {
                pipeline.del(key);
                pipeline.srem(tagKey, key);
            });

            const results = await pipeline.exec();
            const deletedCount =
                results?.filter(([err, result]) => !err && result === 1).length || 0;

            this.stats.deletes += deletedCount;
            return deletedCount;
        } catch (error) {
            this.logger.error('Cache invalidate by tag error:', error);
            return 0;
        }
    }

    async cacheInvalidateByPattern(pattern: string, namespace?: string): Promise<number> {
        try {
            const fullPattern = this.buildKey(pattern, namespace);
            const keys = await this.client.keys(fullPattern);

            if (keys.length === 0) {
                return 0;
            }

            const pipeline = this.client.pipeline();
            keys.forEach(key => {
                pipeline.del(key);
            });

            await pipeline.exec();
            this.stats.deletes += keys.length;
            return keys.length;
        } catch (error) {
            this.logger.error('Cache invalidate by pattern error:', error);
            return 0;
        }
    }

    async cacheGetOrSet<T>(
        key: string,
        factory: () => Promise<T>,
        options?: CacheOptions,
    ): Promise<T> {
        const cached = await this.cacheGet<T>(key, options);

        if (cached !== null) {
            return cached;
        }

        const value = await factory();
        await this.cacheSet(key, value, options);
        return value;
    }

    getCacheStats(): CacheStats {
        return { ...this.stats };
    }

    resetCacheStats(): void {
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0,
            hitRate: 0,
        };
    }

    private buildKey(key: string, namespace?: string): string {
        const prefix = process.env.REDIS_KEY_PREFIX || 'genie:';
        const ns = namespace ? `${namespace}:` : '';
        return `${prefix}${ns}${key}`;
    }

    private async storeCacheTags(key: string, tags: string[]): Promise<void> {
        const pipeline = this.client.pipeline();

        tags.forEach(tag => {
            const tagKey = `tag:${tag}`;
            pipeline.sadd(tagKey, key);
            pipeline.expire(tagKey, 86400); // 24 hours
        });

        await pipeline.exec();
    }

    private async removeFromTagIndexes(key: string): Promise<void> {
        // This is a simplified implementation
        // In a real scenario, you'd need to track which tags each key belongs to
        const pattern = 'tag:*';
        const tagKeys = await this.client.keys(pattern);

        if (tagKeys.length > 0) {
            const pipeline = this.client.pipeline();
            tagKeys.forEach(tagKey => {
                pipeline.srem(tagKey, key);
            });
            await pipeline.exec();
        }
    }

    private updateHitRate(): void {
        const total = this.stats.hits + this.stats.misses;
        this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
    }

    // Health check
    async healthCheck(): Promise<{ status: string; latency: number; memory: any }> {
        const start = Date.now();

        try {
            await this.client.ping();
            const latency = Date.now() - start;
            const memory = await this.client.memory('STATS');

            return {
                status: 'healthy',
                latency,
                memory,
            };
        } catch (error) {
            this.logger.error('Redis health check failed:', error);
            return {
                status: 'unhealthy',
                latency: Date.now() - start,
                memory: null,
            };
        }
    }
}
