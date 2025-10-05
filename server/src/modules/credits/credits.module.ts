import { Module } from '@nestjs/common';
import { RedisModule } from '@nestjs-modules/ioredis';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { CreditsController } from './credits.controller';
import { CreditsService } from './services/credits.service';
import { CreditsAnalyticsService } from './services/credits-analytics.service';
import { CreditBalanceService } from './services/credit-balance.service';
import { CreditTransactionService } from './services/credit-transaction.service';
import { CreditReservationService } from './services/credit-reservation.service';
import { CreditCleanupTask } from './tasks/credit-cleanup.task';
import { SecurityModule } from '../security/security.module';

@Module({
  imports: [
    SecurityModule,
    RedisModule.forRoot({
      type: 'single',
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      options: {
        retryStrategy: times => {
          // Exponential backoff retry strategy
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        reconnectOnError: err => {
          const targetError = 'READONLY';
          if (err.message.includes(targetError)) {
            // Only reconnect when the error contains "READONLY"
            return true;
          }
          return false;
        },
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        enableReadyCheck: false,
        connectTimeout: 10000,
        commandTimeout: 5000,
        family: 4, // IPv4
        keepAlive: 30000,
      },
    }),
    EventEmitterModule.forRoot({
      wildcard: false,
      delimiter: '.',
      newListener: false,
      removeListener: false,
      maxListeners: 10,
      verboseMemoryLeak: true,
      ignoreErrors: false,
    }),
    ScheduleModule.forRoot(),
  ],
  controllers: [CreditsController],
  providers: [
    CreditsService,
    CreditsAnalyticsService,
    CreditBalanceService,
    CreditTransactionService,
    CreditReservationService,
    CreditCleanupTask,
  ],
  exports: [
    CreditsService,
    CreditsAnalyticsService,
    CreditBalanceService,
    CreditTransactionService,
    CreditReservationService,
  ],
})
export class CreditsModule {}
