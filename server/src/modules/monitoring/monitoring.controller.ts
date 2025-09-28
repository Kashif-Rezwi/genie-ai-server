import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Param,
    Query,
    Body,
    UseGuards,
    ValidationPipe,
    Header,
} from '@nestjs/common';
import { LoggingService } from './services/logging.service';
import { MetricsService } from './services/metrics.service';
import { HealthService } from './services/health.service';
import { PerformanceService } from './services/performance.service';
import { ErrorTrackingService } from './services/error-tracking.service';
import { AlertingService } from './services/alerting.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard, Roles, UserRole } from '../security/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('monitoring')
export class MonitoringController {
    constructor(
        private readonly loggingService: LoggingService,
        private readonly metricsService: MetricsService,
        private readonly healthService: HealthService,
        private readonly performanceService: PerformanceService,
        private readonly errorTrackingService: ErrorTrackingService,
        private readonly alertingService: AlertingService,
    ) {}

    // Health endpoints (public)
    @Get('health')
    async getHealth() {
        return this.healthService.checkOverallHealth();
    }

    @Get('health/detailed')
    async getDetailedHealth() {
        return this.healthService.getDetailedHealth();
    }

    @Get('health/service/:serviceName')
    async getServiceHealth(@Param('serviceName') serviceName: string) {
        return this.healthService.getServiceHealth(serviceName);
    }

    // Metrics endpoints
    @Get('metrics')
    @Header('Content-Type', 'text/plain')
    async getPrometheusMetrics() {
        return this.metricsService.exportPrometheusMetrics();
    }

    @Get('metrics/json')
    @UseGuards(JwtAuthGuard)
    async getMetricsJson() {
        return this.metricsService.getAllMetrics();
    }

    @Get('metrics/business')
    @UseGuards(JwtAuthGuard)
    async getBusinessMetrics() {
        return {
            users: {
                total: this.metricsService.getCounterValue('users_total'),
                active: this.metricsService.getGaugeValue('users_active_total'),
            },
            requests: {
                total: this.metricsService.getCounterValue('http_requests_total'),
                duration: this.metricsService.getHistogramStats('http_request_duration_ms'),
            },
            ai: {
                requests: this.metricsService.getCounterValue('ai_requests_total'),
                duration: this.metricsService.getHistogramStats('ai_request_duration_ms'),
            },
            credits: {
                used: this.metricsService.getCounterValue('credits_used_total'),
            },
            payments: {
                total: this.metricsService.getCounterValue('payments_total'),
            },
            errors: {
                total: this.metricsService.getCounterValue('errors_total'),
            },
        };
    }

    // Performance endpoints
    @Get('performance')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    async getPerformanceMetrics(@Query('timeRange') timeRange?: string) {
        const range = timeRange ? parseInt(timeRange) : 3600000; // Default 1 hour
        return this.performanceService.getPerformanceMetrics(range);
    }

    @Get('performance/response-times')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    async getResponseTimeDistribution(@Query('timeRange') timeRange?: string) {
        const range = timeRange ? parseInt(timeRange) : 3600000;
        return this.performanceService.getResponseTimeDistribution(range);
    }

    @Get('performance/slow-endpoints')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    async getSlowEndpoints(@Query('limit') limit?: string) {
        const limitNum = limit ? parseInt(limit) : 10;
        return this.performanceService.getTopSlowEndpoints(limitNum);
    }

    // Error tracking endpoints
    @Get('errors')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    async getErrorSummary(@Query('timeRange') timeRange?: string) {
        const range = timeRange ? parseInt(timeRange) : 3600000;
        return this.errorTrackingService.getErrorSummary(range);
    }

    @Get('errors/recent')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    async getRecentErrors(@Query('limit') limit?: string) {
        const limitNum = limit ? parseInt(limit) : 50;
        return this.errorTrackingService.getRecentErrors(limitNum);
    }

    @Get('errors/search')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    async searchErrors(@Query('q') query: string, @Query('limit') limit?: string) {
        const limitNum = limit ? parseInt(limit) : 50;
        return this.errorTrackingService.searchErrors(query, limitNum);
    }

    @Get('errors/:fingerprint')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    async getError(@Param('fingerprint') fingerprint: string) {
        return this.errorTrackingService.getError(fingerprint);
    }

    @Put('errors/:fingerprint/resolve')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    async resolveError(@Param('fingerprint') fingerprint: string) {
        const resolved = this.errorTrackingService.resolveError(fingerprint);
        return { resolved, fingerprint };
    }

    // User-specific error endpoints
    @Get('errors/user/:userId')
    @UseGuards(JwtAuthGuard)
    async getUserErrors(
        @Param('userId') userId: string,
        @CurrentUser() user: any,
        @Query('limit') limit?: string,
    ) {
        // Users can only see their own errors, admins can see any user's errors
        if (user.role !== UserRole.ADMIN && user.id !== userId) {
            throw new Error('Access denied');
        }

        const limitNum = limit ? parseInt(limit) : 20;
        return this.errorTrackingService.getErrorsByUser(userId, limitNum);
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
        const limitNum = limit ? parseInt(limit) : 100;
        return this.alertingService.getAlertHistory(limitNum);
    }

    @Get('alerts/rules')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    async getAlertRules() {
        return this.alertingService.getAlertRules();
    }

    @Put('alerts/:alertId/resolve')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    async resolveAlert(@Param('alertId') alertId: string) {
        const resolved = this.alertingService.resolveAlert(alertId);
        return { resolved, alertId };
    }

    @Post('alerts/custom')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    async sendCustomAlert(
        @Body(ValidationPipe)
        body: {
            title: string;
            message: string;
            severity?: 'low' | 'medium' | 'high' | 'critical';
            channels?: string[];
        },
    ) {
        await this.alertingService.sendCustomAlert(
            body.title,
            body.message,
            body.severity,
            body.channels,
        );
        return { success: true };
    }

    @Put('alerts/rules/:ruleId')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    async updateAlertRule(@Param('ruleId') ruleId: string, @Body(ValidationPipe) updates: any) {
        const updated = this.alertingService.updateAlertRule(ruleId, updates);
        return { updated, ruleId };
    }

    // Logging endpoints
    @Get('logs/stats')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    async getLogStats(@Query('hours') hours?: string) {
        const hoursNum = hours ? parseInt(hours) : 24;
        return this.loggingService.getLogStats(hoursNum);
    }

    @Post('logs/test')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    async testLogging(@Body() body: { level: string; message: string }) {
        const { level, message } = body;

        switch (level) {
            case 'info':
                this.loggingService.logInfo(message, { test: true });
                break;
            case 'warn':
                this.loggingService.logWarning(message, { test: true });
                break;
            case 'error':
                this.loggingService.logError(message, {
                    error: new Error('Test error'),
                    context: { test: true },
                });
                break;
            default:
                this.loggingService.logInfo(message, { test: true });
        }

        return { success: true, level, message };
    }

    // Dashboard data endpoint
    @Get('dashboard')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    async getDashboardData() {
        const [health, performance, errors, alerts, metrics] = await Promise.all([
            this.healthService.getDetailedHealth(),
            this.performanceService.getPerformanceMetrics(),
            this.errorTrackingService.getErrorSummary(),
            this.alertingService.getActiveAlerts(),
            this.metricsService.getAllMetrics(),
        ]);

        return {
            health: {
                status: health.status,
                uptime: health.uptime,
                services: Object.entries(health.services).map(([name, service]) => ({
                    name,
                    status: service.status,
                    responseTime: service.responseTime,
                })),
            },
            performance: {
                requests: {
                    total: performance.requests.total,
                    averageResponseTime: performance.requests.averageResponseTime,
                    errorRate: (performance.requests.failed / performance.requests.total) * 100,
                },
                memory: {
                    usage: performance.memory.usagePercentage,
                    heapUsed: performance.memory.heapUsed,
                },
                errors: {
                    rate: performance.errors.rate,
                    recentCount: performance.errors.count,
                },
            },
            errors: {
                total: errors.totalErrors,
                rate: errors.errorRate,
                topErrors: errors.topErrors.slice(0, 5),
            },
            alerts: {
                active: alerts.length,
                critical: alerts.filter(a => a.severity === 'critical').length,
                high: alerts.filter(a => a.severity === 'high').length,
            },
            metrics: {
                counters: metrics.counters.length,
                gauges: metrics.gauges.length,
                histograms: metrics.histograms.length,
            },
        };
    }
}
