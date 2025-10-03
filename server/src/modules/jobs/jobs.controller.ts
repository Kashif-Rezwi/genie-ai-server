import {
    Controller,
    Get,
    Post,
    Param,
    Query,
    Body,
    UseGuards,
} from '@nestjs/common';
import { JobService } from './services/job.service';
import { EmailService } from './services/email.service';
import { JobAuditService } from './services/job-audit.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard, Roles, UserRole } from '../security/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('jobs')
@UseGuards(JwtAuthGuard)
export class JobsController {
    constructor(
        private readonly jobService: JobService,
        private readonly emailService: EmailService,
        private readonly jobAuditService: JobAuditService,
    ) {}

    // Basic job stats - available to all users
    @Get('stats')
    async getJobStats() {
        return this.jobService.getQueueStats();
    }

    // Job status by ID - available to all users
    @Get('status/:jobId')
    async getJobStatus(@Param('jobId') jobId: string) {
        return this.jobService.getJobStatus(jobId);
    }

    // Admin-only endpoints
    @Post('retry-failed')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    async retryFailedJobs(@Query('limit') limit: number = 10) {
        return this.jobService.retryFailedJobs(limit);
    }

    @Post('pause')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    async pauseQueue() {
        await this.jobService.pauseQueue();
        return { message: 'Email queue paused' };
    }

    @Post('resume')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    async resumeQueue() {
        await this.jobService.resumeQueue();
        return { message: 'Email queue resumed' };
    }

    // Email management endpoints
    @Post('email/send-welcome')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    async sendWelcomeEmail(@Body() body: { email: string; userData: any }) {
        const { email, userData } = body;
        await this.emailService.sendWelcomeEmail(email, userData);
        return { message: 'Welcome email sent successfully' };
    }

    @Post('email/send-payment-confirmation')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    async sendPaymentConfirmation(@Body() body: { email: string; paymentData: any }) {
        const { email, paymentData } = body;
        await this.emailService.sendPaymentConfirmationEmail(email, paymentData);
        return { message: 'Payment confirmation email sent successfully' };
    }

    @Post('email/send-payment-failure')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    async sendPaymentFailure(@Body() body: { email: string; failureData: any }) {
        const { email, failureData } = body;
        await this.emailService.sendPaymentFailureEmail(email, failureData);
        return { message: 'Payment failure email sent successfully' };
    }

    // Job audit endpoints
    @Get('audit/history')
    async getJobHistory(
        @CurrentUser() user: any,
        @Query('limit') limit: number = 20,
    ) {
        return this.jobAuditService.getJobHistory(user.id, limit);
    }

    @Get('audit/:jobId')
    async getJobAudit(@Param('jobId') jobId: string) {
        return this.jobAuditService.getJobAudit(jobId);
    }

    @Get('audit/failed')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    async getFailedJobs(@Query('limit') limit: number = 20) {
        return this.jobAuditService.getFailedJobs(limit);
    }

    @Post('audit/cleanup')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    async cleanupOldAudits(@Query('days') days: number = 30) {
        const cleaned = await this.jobAuditService.cleanupOldAudits(days);
        return { message: `Cleaned up ${cleaned} old job audit records` };
    }
}