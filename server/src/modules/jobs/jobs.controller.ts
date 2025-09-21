import {
    Controller,
    Get,
    Post,
    Delete,
    Param,
    Query,
    Body,
    UseGuards,
    ValidationPipe
} from '@nestjs/common';
import { JobService } from './services/job.service';
import { AnalyticsJobService } from './services/analytics-job.service';
import { MaintenanceJobService } from './services/maintenance-job.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard, Roles, UserRole } from '../security/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('jobs')
@UseGuards(JwtAuthGuard)
export class JobsController {
    constructor(
        private readonly jobService: JobService,
        private readonly analyticsJobService: AnalyticsJobService,
        private readonly maintenanceJobService: MaintenanceJobService,
    ) { }

    @Get('stats')
    async getJobStats() {
        return this.jobService.getAllQueueStats();
    }

    @Get('status/:queueName/:jobId')
    async getJobStatus(
        @Param('queueName') queueName: string,
        @Param('jobId') jobId: string
    ) {
        return this.jobService.getJobStatus(queueName, jobId);
    }

    @Get('queue/:queueName/stats')
    async getQueueStats(@Param('queueName') queueName: string) {
        return this.jobService.getQueueStats(queueName);
    }

    // Admin-only endpoints
    @Post('analytics/trigger')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    async triggerAnalytics(
        @Body() body: { type: 'daily' | 'weekly' | 'monthly' }
    ) {
        const { type } = body;

        switch (type) {
            case 'daily':
                return this.analyticsJobService.generateDailyMetrics();
            case 'weekly':
                return this.analyticsJobService.generateWeeklyMetrics();
            case 'monthly':
                return this.analyticsJobService.generateMonthlyMetrics();
            default:
                throw new Error('Invalid analytics type');
        }
    }

    @Post('maintenance/trigger')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    async triggerMaintenance(
        @Body() body: {
            task: 'cleanup' | 'backup' | 'reconcile' | 'optimize' | 'security_scan';
            targetTable?: string;
            dryRun?: boolean;
        }
    ) {
        return this.jobService.addMaintenanceJob({
            task: body.task,
            targetTable: body.targetTable,
            dryRun: body.dryRun || false,
        });
    }

    @Post('queue/:queueName/pause')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    async pauseQueue(@Param('queueName') queueName: string) {
        await this.jobService.pauseQueue(queueName);
        return { message: `Queue ${queueName} paused` };
    }

    @Post('queue/:queueName/resume')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    async resumeQueue(@Param('queueName') queueName: string) {
        await this.jobService.resumeQueue(queueName);
        return { message: `Queue ${queueName} resumed` };
    }

    @Post('queue/:queueName/retry-failed')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    async retryFailedJobs(
        @Param('queueName') queueName: string,
        @Query('limit') limit: number = 10
    ) {
        const retriedCount = await this.jobService.retryFailedJobs(queueName, limit);
        return { message: `Retried ${retriedCount} jobs` };
    }

    @Get('user/history')
    async getUserJobHistory(@CurrentUser() user: any) {
        // Return user's job history (AI jobs, payment jobs, etc.)
        return {
            aiJobs: [],
            paymentJobs: [],
            emailJobs: [],
        };
    }
}