import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QueryCacheService } from './services/query-cache.service';
import { BackgroundJobService } from './services/background-job.service';
import { OptimizedCreditReservationService } from './services/optimized-credit-reservation.service';
import { DatabaseOptimizationService } from './services/database-optimization.service';
import { MemoryOptimizationService } from './services/memory-optimization.service';
import { RedisOptimizationService } from './services/redis-optimization.service';
import { PerformanceMonitoringService } from './services/performance-monitoring.service';
import { PerformanceController } from './performance.controller';
import { PerformanceService } from './services/performance.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([]), // Add entities if needed
  ],
  controllers: [PerformanceController],
  providers: [
    QueryCacheService,
    BackgroundJobService,
    OptimizedCreditReservationService,
    DatabaseOptimizationService,
    MemoryOptimizationService,
    RedisOptimizationService,
    PerformanceMonitoringService,
    PerformanceService,
  ],
  exports: [
    QueryCacheService,
    BackgroundJobService,
    OptimizedCreditReservationService,
    DatabaseOptimizationService,
    MemoryOptimizationService,
    RedisOptimizationService,
    PerformanceMonitoringService,
    PerformanceService,
  ],
})
export class PerformanceModule {}
