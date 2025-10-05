import { Module } from '@nestjs/common';
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
