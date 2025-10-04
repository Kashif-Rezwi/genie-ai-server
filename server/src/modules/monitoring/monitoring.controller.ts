import {
    Controller,
    Get,
    Post,
    UseGuards,
    Query,
    Param,
} from '@nestjs/common';
import { LoggingService } from './services/logging.service';
import { HealthService } from './services/health.service';
import { ErrorService } from './services/error.service';
import { MetricsService } from './services/metrics.service';
import { AlertingService } from './services/alerting.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard, Roles, UserRole } from '../security/guards/roles.guard';

@Controller('monitoring')
export class MonitoringController {
    constructor(
        private readonly loggingService: LoggingService,
        private readonly healthService: HealthService,
        private readonly errorService: ErrorService,
        private readonly metricsService: MetricsService,
        private readonly alertingService: AlertingService,
    ) {}

    // Health endpoint (public)
    @Get('health')
    async getHealth() {
        return this.healthService.getQuickHealthStatus();
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
        const activeAlerts = await this.alertingService.getActiveAlerts();
        
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
                security: metrics.security,
                system: metrics.system,
            },
            alerts: {
                active: activeAlerts.length,
                critical: activeAlerts.filter(a => a.severity === 'critical').length,
                recent: activeAlerts.slice(0, 10),
            },
            system: {
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                version: process.env.npm_package_version || '1.0.0',
            },
            monitoring: {
                services: ['logging', 'health', 'errors', 'metrics', 'alerting'],
                status: 'active',
            },
        };
    }

    // Detailed metrics endpoints
    @Get('metrics/requests')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    async getRequestMetrics() {
        return this.metricsService.getRequestMetrics();
    }

    @Get('metrics/errors')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    async getErrorMetrics() {
        return this.metricsService.getErrorMetrics();
    }

    @Get('metrics/performance')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    async getPerformanceMetrics() {
        return this.metricsService.getPerformanceMetrics();
    }

    @Get('metrics/business')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    async getBusinessMetrics() {
        return this.metricsService.getBusinessMetrics();
    }

    @Get('metrics/security')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    async getSecurityMetrics() {
        return this.metricsService.getSecurityMetrics();
    }

    @Get('metrics/system')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    async getSystemMetrics() {
        return this.metricsService.getSystemMetrics();
    }

    // Alerting endpoints
    @Get('alerts')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    async getActiveAlerts() {
        return this.alertingService.getActiveAlerts();
    }

    @Get('alerts/history')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    async getAlertHistory(@Query('limit') limit?: string) {
        const limitNum = limit ? parseInt(limit, 10) : 50;
        return this.alertingService.getAlertHistory(limitNum);
    }

    @Post('alerts/:alertId/resolve')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    async resolveAlert(@Param('alertId') alertId: string) {
        await this.alertingService.resolveAlert(alertId);
        return { message: 'Alert resolved successfully' };
    }

    // Health check endpoints
    @Get('health/detailed')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    async getDetailedHealth() {
        const [database, redis, memory] = await Promise.allSettled([
            this.healthService.checkDatabase(),
            this.healthService.checkRedis(),
            this.healthService.checkMemory(),
        ]);

        return {
            database: database.status === 'fulfilled' ? database.value : { status: 'error', error: database.reason },
            redis: redis.status === 'fulfilled' ? redis.value : { status: 'error', error: redis.reason },
            memory: memory.status === 'fulfilled' ? memory.value : { status: 'error', error: memory.reason },
            timestamp: new Date(),
        };
    }

    @Get('health/comprehensive')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    async getComprehensiveHealth() {
        return this.healthService.getComprehensiveHealthStatus();
    }

    @Get('performance/health')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    async getPerformanceHealthMetrics() {
        return this.healthService.getPerformanceMetrics();
    }

    // Logs endpoint
    @Get('logs')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    async getLogs(@Query('level') level?: string, @Query('limit') limit?: string) {
        // For MVP, return a placeholder
        // In production, this would query log files or log aggregation service
        return {
            message: 'Log retrieval not implemented in MVP',
            level,
            limit: limit || '100',
            note: 'In production, this would integrate with log aggregation service',
        };
    }

    // System status endpoint
    @Get('status')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    async getSystemStatus() {
        const metrics = this.metricsService.getMetrics();
        const activeAlerts = await this.alertingService.getActiveAlerts();
        
        // Determine overall system status
        let status = 'healthy';
        if (activeAlerts.some(a => a.severity === 'critical')) {
            status = 'critical';
        } else if (activeAlerts.some(a => a.severity === 'high')) {
            status = 'warning';
        } else if (metrics.requests.total > 0 && (metrics.requests.errors / metrics.requests.total) > 0.05) { // 5% error rate
            status = 'degraded';
        }

        return {
            status,
            timestamp: new Date(),
            uptime: process.uptime(),
            version: process.env.npm_package_version || '1.0.0',
            environment: process.env.NODE_ENV || 'development',
            metrics: {
                requests: metrics.requests.total,
                errors: metrics.requests.errors,
                errorRate: metrics.requests.total > 0 ? metrics.requests.errors / metrics.requests.total : 0,
                avgResponseTime: metrics.requests.avgResponseTime,
            },
            alerts: {
                total: activeAlerts.length,
                critical: activeAlerts.filter(a => a.severity === 'critical').length,
                high: activeAlerts.filter(a => a.severity === 'high').length,
            },
        };
    }
}