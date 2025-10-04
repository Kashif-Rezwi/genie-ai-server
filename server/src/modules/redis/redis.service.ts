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
        return this.client.get(key);
    }

    async set(key: string, value: string, ttl?: number): Promise<'OK'> {
        if (ttl) {
            return this.client.setex(key, ttl, value);
        }
        return this.client.set(key, value);
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

    async decr(key: string): Promise<number> {
        return this.client.decr(key);
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
}
