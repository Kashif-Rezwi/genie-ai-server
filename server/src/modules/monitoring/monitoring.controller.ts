import { Controller, Get, UseGuards } from '@nestjs/common';
import { LoggingService } from './services/logging.service';
import { HealthService } from './services/health.service';
import { ErrorService } from './services/error.service';
import { MetricsService } from './services/metrics.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard, Roles, UserRole } from '../security/guards/roles.guard';

@Controller('monitoring')
export class MonitoringController {
    constructor(
        private readonly loggingService: LoggingService,
        private readonly healthService: HealthService,
        private readonly errorService: ErrorService,
        private readonly metricsService: MetricsService,
    ) {}

    // Health endpoint (public)
    @Get('health')
    async getHealth() {
        return this.healthService.getQuickHealthStatus();
    }

    // Detailed health endpoint (admin only)
    @Get('health/detailed')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    async getDetailedHealth() {
        return this.healthService.getDetailedHealthStatus();
    }

    // Metrics endpoint (admin only)
    @Get('metrics')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    async getMetrics() {
        return this.metricsService.getMetrics();
    }

    // Dashboard data endpoint (admin only)
    @Get('dashboard')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    async getDashboardData() {
        const health = await this.healthService.getQuickHealthStatus();
        const metrics = this.metricsService.getMetrics();

        return {
            health: {
                status: health.status,
                timestamp: health.timestamp,
            },
            metrics: {
                requests: metrics.requests,
                errors: metrics.errors,
                performance: metrics.performance,
                business: metrics.business,
            },
            system: {
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                version: process.env.npm_package_version || '1.0.0',
            },
            monitoring: {
                services: ['logging', 'health', 'errors', 'metrics'],
                status: 'active',
            },
        };
    }
}
