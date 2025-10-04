import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductionReadinessController } from './production-readiness.controller';
import { SecurityAuditService } from '../security/services/security-audit.service';
import { HealthService } from '../monitoring/services/health.service';
import { MetricsService } from '../monitoring/services/metrics.service';
import { AlertingService } from '../monitoring/services/alerting.service';
import { LoggingService } from '../monitoring/services/logging.service';
import { RedisService } from '../redis/redis.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([]),
  ],
  controllers: [ProductionReadinessController],
  providers: [
    SecurityAuditService,
    HealthService,
    MetricsService,
    AlertingService,
    LoggingService,
    RedisService,
  ],
  exports: [
    SecurityAuditService,
    ProductionReadinessController,
  ],
})
export class ProductionModule {}
