import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { Chat } from '../entities/chat.entity';
import { Message } from '../entities/message.entity';
import { CreditTransaction } from '../entities/credit-transaction.entity';
import { CreditAuditLog } from '../entities/credit-audit-log.entity';

export const databaseConfig = (): TypeOrmModuleOptions => {
    const isProduction = process.env.NODE_ENV === 'production';
    const isDevelopment = process.env.NODE_ENV === 'development';

    return {
        type: 'postgres',
        host: process.env.POSTGRES_HOST || 'localhost',
        port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
        username: process.env.POSTGRES_USER,
        password: process.env.POSTGRES_PASSWORD,
        database: process.env.POSTGRES_DB,
        entities: [User, Chat, Message, CreditTransaction, CreditAuditLog],
        synchronize: isDevelopment, // Auto-sync in dev only
        logging: isDevelopment ? ['query', 'error'] : ['error'],
        ssl: isProduction ? { rejectUnauthorized: false } : false,

        // Enhanced connection pool settings for production
        extra: {
            // Connection pool configuration
            max: parseInt(process.env.DB_POOL_MAX || (isProduction ? '50' : '20'), 10),
            min: parseInt(process.env.DB_POOL_MIN || (isProduction ? '10' : '5'), 10),
            acquire: parseInt(process.env.DB_ACQUIRE_TIMEOUT || '30000', 10),
            idle: parseInt(process.env.DB_IDLE_TIMEOUT || '10000', 10),
            evict: parseInt(process.env.DB_EVICT_INTERVAL || '1000', 10),

            // Connection management
            handleDisconnects: true,
            validate: true,
            connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '10000', 10),

            // Query and statement timeouts
            query_timeout: parseInt(process.env.DB_QUERY_TIMEOUT || '30000', 10),
            statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || '30000', 10),
            idle_in_transaction_session_timeout: parseInt(
                process.env.DB_IDLE_TRANSACTION_TIMEOUT || '30000',
                10,
            ),

            // Performance optimizations
            application_name: 'genie-ai-server',
            tcp_keepalives_idle: parseInt(process.env.DB_TCP_KEEPALIVE_IDLE || '600', 10),
            tcp_keepalives_interval: parseInt(process.env.DB_TCP_KEEPALIVE_INTERVAL || '30', 10),
            tcp_keepalives_count: parseInt(process.env.DB_TCP_KEEPALIVE_COUNT || '3', 10),

            // Connection retry settings
            retryDelayMs: parseInt(process.env.DB_RETRY_DELAY || '1000', 10),
            maxRetries: parseInt(process.env.DB_MAX_RETRIES || '3', 10),

            // Pool monitoring
            poolErrorHandler: (err: Error) => {
                // In production, this should be sent to proper logging service
                if (process.env.NODE_ENV === 'development') {
                    console.error('Database pool error:', err);
                }
            },
        },

        // Additional TypeORM options
        cache: {
            type: 'redis',
            options: {
                host: process.env.REDIS_HOST || 'localhost',
                port: parseInt(process.env.REDIS_PORT || '6379', 10),
                password: process.env.REDIS_PASSWORD,
                db: parseInt(process.env.REDIS_DB || '1', 10),
            },
            duration: parseInt(process.env.DB_CACHE_DURATION || '30000', 10), // 30 seconds
        },

        // Migration settings
        migrations: ['dist/database/migrations/*.js'],
        migrationsRun: isProduction,
        migrationsTableName: 'migrations',

        // Performance settings
        maxQueryExecutionTime: parseInt(process.env.DB_MAX_QUERY_TIME || '5000', 10), // 5 seconds
        dropSchema: false,
        migrationsTransactionMode: 'each',
    };
};
