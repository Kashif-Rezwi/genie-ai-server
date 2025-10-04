import { Module } from '@nestjs/common';
import { RedisModule } from '@nestjs-modules/ioredis';
import { ScheduleModule } from '@nestjs/schedule';
import { QueryCacheService } from './services/query-cache.service';
import { BackgroundJobService } from './services/background-job.service';
import { OptimizedCreditReservationService } from './services/optimized-credit-reservation.service';
import { PerformanceController } from './performance.controller';
import { PerformanceService } from './services/performance.service';

@Module({
  imports: [
    RedisModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [PerformanceController],
  providers: [
    QueryCacheService,
    BackgroundJobService,
    OptimizedCreditReservationService,
    PerformanceService,
  ],
  exports: [
    QueryCacheService,
    BackgroundJobService,
    OptimizedCreditReservationService,
    PerformanceService,
  ],
})
export class PerformanceModule {}
