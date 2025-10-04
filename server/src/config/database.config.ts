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
    
    // Optimized connection pool settings
    extra: {
        max: parseInt(process.env.DB_POOL_MAX || '20', 10), // Max connections
        min: parseInt(process.env.DB_POOL_MIN || '5', 10),  // Min connections
        acquire: 30000, // Maximum time to acquire connection
        idle: 10000,    // Maximum idle time
        evict: 1000,    // Check for idle connections every 1 second
        handleDisconnects: true,
        validate: true,
        // Connection timeout
        connectionTimeoutMillis: 10000,
        // Query timeout
        query_timeout: 30000,
        // Statement timeout
        statement_timeout: 30000,
        // Idle timeout
        idle_in_transaction_session_timeout: 30000,
    },
});
