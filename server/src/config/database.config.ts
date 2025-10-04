import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { Chat } from '../entities/chat.entity';
import { Message } from '../entities/message.entity';
import { CreditTransaction } from '../entities/credit-transaction.entity';
import { CreditAuditLog } from '../entities/credit-audit-log.entity';

export const databaseConfig = (): TypeOrmModuleOptions => ({
    type: 'postgres',
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    username: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB,
    entities: [User, Chat, Message, CreditTransaction, CreditAuditLog],
    synchronize: process.env.NODE_ENV === 'development', // Auto-sync in dev only
    logging: process.env.NODE_ENV === 'development',
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    
    // Enhanced connection pool settings for better performance
    extra: {
        max: parseInt(process.env.DB_POOL_MAX || '20', 10), // Increased for better concurrency
        min: parseInt(process.env.DB_POOL_MIN || '5', 10),  // Increased minimum
        acquire: 30000, // 30 seconds to acquire connection
        idle: 10000,    // 10 seconds idle timeout
        evict: 1000,    // 1 second eviction check
        handleDisconnects: true,
    },
    
    // Query optimization (disabled for now - can be enabled later)
    // cache: {
    //     type: 'redis',
    //     options: {
    //         host: process.env.REDIS_HOST || 'localhost',
    //         port: parseInt(process.env.REDIS_PORT || '6379', 10),
    //         db: 2, // Use separate Redis DB for query cache
    //     },
    //     duration: 30000, // 30 seconds cache duration
    // },
});
