import { Module, Global } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MonitoringController } from './monitoring.controller';
import { LoggingService } from './services/logging.service';
import { HealthService } from './services/health.service';
import { ErrorService } from './services/error.service';
import { MetricsService } from './services/metrics.service';
import { RequestMonitoringMiddleware } from './middleware/request-monitoring.middleware';
import { EmailModule } from '../email/email.module';
import { User } from '../../entities';

@Global()
@Module({
    imports: [TerminusModule, TypeOrmModule.forFeature([User]), EmailModule],
    controllers: [MonitoringController],
    providers: [
        LoggingService,
        HealthService,
        ErrorService,
        MetricsService,
        RequestMonitoringMiddleware,
    ],
    exports: [
        LoggingService,
        HealthService,
        ErrorService,
        MetricsService,
        RequestMonitoringMiddleware,
    ],
})
export class MonitoringModule {}
