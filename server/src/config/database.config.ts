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
    
    // Simple connection pool settings (TypeORM handles the rest)
    extra: {
        max: parseInt(process.env.DB_POOL_MAX || '10', 10), // Max connections
        min: parseInt(process.env.DB_POOL_MIN || '2', 10),  // Min connections
    },
});
