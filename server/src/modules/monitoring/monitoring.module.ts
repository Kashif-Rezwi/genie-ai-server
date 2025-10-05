import { Module, Global } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { MonitoringController } from './monitoring.controller';
import { APMController } from './controllers/apm.controller';
import { AnalyticsController } from './controllers/analytics.controller';
import { PerformanceController } from './controllers/performance.controller';
import { CostMonitoringController } from './controllers/cost-monitoring.controller';
import { BusinessAlertsController } from './controllers/business-alerts.controller';
import { APMService } from './services/apm.service';
import { BusinessAnalyticsService } from './services/business-analytics.service';
import { PerformanceRegressionService } from './services/performance-regression.service';
import { CostMonitoringService } from './services/cost-monitoring.service';
import { BusinessAlertsService } from './services/business-alerts.service';
import { RequestMonitoringMiddleware } from './middleware/request-monitoring.middleware';
import { EmailModule } from '../email/email.module';

@Global()
@Module({
  imports: [TerminusModule, EmailModule],
  controllers: [
    MonitoringController,
    APMController,
    AnalyticsController,
    PerformanceController,
    CostMonitoringController,
    BusinessAlertsController,
  ],
  providers: [
    APMService,
    BusinessAnalyticsService,
    PerformanceRegressionService,
    CostMonitoringService,
    BusinessAlertsService,
    RequestMonitoringMiddleware,
  ],
  exports: [
    APMService,
    BusinessAnalyticsService,
    PerformanceRegressionService,
    CostMonitoringService,
    BusinessAlertsService,
    RequestMonitoringMiddleware,
  ],
})
export class MonitoringModule {}
