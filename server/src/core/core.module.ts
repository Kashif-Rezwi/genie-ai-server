import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RedisModule } from '@nestjs-modules/ioredis';
import { User, Chat, Message, CreditTransaction, Payment, CreditAuditLog } from '../entities';
import { UserRepository } from './repositories/user.repository';
import { ChatRepository } from './repositories/chat.repository';
import { MessageRepository } from './repositories/message.repository';
import { CreditTransactionRepository } from './repositories/credit-transaction.repository';
import { PaymentRepository } from './repositories/payment.repository';
import { CreditAuditLogRepository } from './repositories/credit-audit-log.repository';

// Shared Services
import { RedisService } from '../modules/redis/redis.service';
import { LoggingService } from '../modules/monitoring/services/logging.service';
import { MetricsService } from '../modules/monitoring/services/metrics.service';
import { ErrorService } from '../modules/monitoring/services/error.service';
import { HealthService } from '../modules/monitoring/services/health.service';
import { AlertingService } from '../modules/monitoring/services/alerting.service';

/**
 * Core Module
 * Provides shared services and repositories across the application
 * This module should be imported by all other modules that need data access
 */
@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Chat,
      Message,
      CreditTransaction,
      Payment,
      CreditAuditLog,
    ]),
    // Redis configuration for shared services
    RedisModule.forRoot({
      type: 'single',
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      options: {
        retryStrategy: times => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        reconnectOnError: err => {
          const targetError = 'READONLY';
          if (err.message.includes(targetError)) {
            return true;
          }
          return false;
        },
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        enableReadyCheck: false,
        connectTimeout: 10000,
        commandTimeout: 5000,
        family: 4,
        keepAlive: 30000,
      },
    }),
  ],
  providers: [
    // Repository implementations
    UserRepository,
    ChatRepository,
    MessageRepository,
    CreditTransactionRepository,
    PaymentRepository,
    CreditAuditLogRepository,
    
    // Shared Services
    RedisService,
    LoggingService,
    MetricsService,
    ErrorService,
    HealthService,
    AlertingService,
  ],
  exports: [
    // Export repositories for use in other modules
    UserRepository,
    ChatRepository,
    MessageRepository,
    CreditTransactionRepository,
    PaymentRepository,
    CreditAuditLogRepository,
    
    // Export shared services for use in other modules
    RedisService,
    LoggingService,
    MetricsService,
    ErrorService,
    HealthService,
    AlertingService,
  ],
})
export class CoreModule {}
