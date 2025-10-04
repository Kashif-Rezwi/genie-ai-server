import { Module, Global } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MonitoringController } from './monitoring.controller';
import { AdvancedMonitoringController } from './advanced-monitoring.controller';
import { LoggingService } from './services/logging.service';
import { HealthService } from './services/health.service';
import { ErrorService } from './services/error.service';
import { MetricsService } from './services/metrics.service';
import { AlertingService } from './services/alerting.service';
import { APMService } from './services/apm.service';
import { BusinessAnalyticsService } from './services/business-analytics.service';
import { PerformanceRegressionService } from './services/performance-regression.service';
import { CostMonitoringService } from './services/cost-monitoring.service';
import { BusinessAlertsService } from './services/business-alerts.service';
import { RequestMonitoringMiddleware } from './middleware/request-monitoring.middleware';
import { EmailModule } from '../email/email.module';
import { RedisService } from '../redis/redis.service';
import { User, CreditTransaction, Payment, Chat, Message } from '../../entities';

@Global()
@Module({
  imports: [
    TerminusModule, 
    TypeOrmModule.forFeature([User, CreditTransaction, Payment, Chat, Message]), 
    EmailModule
  ],
  controllers: [MonitoringController, AdvancedMonitoringController],
  providers: [
    LoggingService,
    HealthService,
    ErrorService,
    MetricsService,
    AlertingService,
    APMService,
    BusinessAnalyticsService,
    PerformanceRegressionService,
    CostMonitoringService,
    BusinessAlertsService,
    RequestMonitoringMiddleware,
    RedisService,
  ],
  exports: [
    LoggingService,
    HealthService,
    ErrorService,
    MetricsService,
    AlertingService,
    APMService,
    BusinessAnalyticsService,
    PerformanceRegressionService,
    CostMonitoringService,
    BusinessAlertsService,
    RequestMonitoringMiddleware,
  ],
})
export class MonitoringModule {}
