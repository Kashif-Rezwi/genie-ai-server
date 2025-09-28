import { Module, Global } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MonitoringController } from './monitoring.controller';
import { LoggingService } from './services/logging.service';
import { MetricsService } from './services/metrics.service';
import { HealthService } from './services/health.service';
import { PerformanceService } from './services/performance.service';
import { ErrorTrackingService } from './services/error-tracking.service';
import { AlertingService } from './services/alerting.service';
import { RequestMonitoringMiddleware } from './middleware/request-monitoring.middleware';
import { ErrorMonitoringMiddleware } from './middleware/error-monitoring.middleware';
import { SecurityModule } from '../security/security.module';
import { JobsModule } from '../jobs/jobs.module';
import { User, Chat, Message, Payment } from '../../entities';

@Global()
@Module({
    imports: [
        TerminusModule,
        TypeOrmModule.forFeature([User, Chat, Message, Payment]),
        SecurityModule,
        JobsModule,
    ],
    controllers: [MonitoringController],
    providers: [
        LoggingService,
        MetricsService,
        HealthService,
        PerformanceService,
        ErrorTrackingService,
        AlertingService,
        RequestMonitoringMiddleware,
        ErrorMonitoringMiddleware,
    ],
    exports: [
        LoggingService,
        MetricsService,
        HealthService,
        PerformanceService,
        ErrorTrackingService,
        AlertingService,
        RequestMonitoringMiddleware,
        ErrorMonitoringMiddleware,
    ],
})
export class MonitoringModule {}
