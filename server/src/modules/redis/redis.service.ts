import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { redisConfig } from '../../config';

@Injectable()
export class RedisService {
    private readonly client: Redis;
    private readonly subscriber: Redis;
    private readonly publisher: Redis;

    constructor() {
        const config = redisConfig();

        this.client = new Redis(config);
        this.subscriber = new Redis(config);
        this.publisher = new Redis(config);

        this.client.on('error', err => {
            console.error('Redis Client Error:', err);
        });

        this.client.on('connect', () => {
            console.log('✅ Redis connected successfully');
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
            console.error('Redis GET error:', error);
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
            console.error('Redis SET error:', error);
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
            console.error('Redis getOrSet error:', error);
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
            console.error('Redis invalidatePattern error:', error);
            return 0;
        }
    }

    async getMultiple(keys: string[]): Promise<(string | null)[]> {
        try {
            return await this.client.mget(...keys);
        } catch (error) {
            console.error('Redis getMultiple error:', error);
            return keys.map(() => null);
        }
    }

    async setMultiple(keyValuePairs: Array<{ key: string; value: string; ttl?: number }>): Promise<void> {
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
            console.error('Redis setMultiple error:', error);
            throw error;
        }
    }
}
