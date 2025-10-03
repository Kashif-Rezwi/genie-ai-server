import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnModuleDestroy } from '@nestjs/common';
import { Job } from 'bullmq';
import { EmailJobData, JobError } from '../interfaces/job.interface';
import { QUEUE_NAMES } from '../constants/queue-names';
import { EmailService } from '../services/email.service';
import { JobAuditService } from '../services/job-audit.service';

@Processor(QUEUE_NAMES.EMAIL_NOTIFICATIONS, {
    concurrency: 5, // Process up to 5 emails concurrently
    limiter: {
        max: 100, // Max 100 emails per minute
        duration: 60000, // Per minute
    },
})
export class EmailJobProcessor extends WorkerHost implements OnModuleDestroy {
    private readonly logger = new Logger(EmailJobProcessor.name);
    private isShuttingDown = false;

    constructor(
        private readonly emailService: EmailService,
        private readonly jobAuditService: JobAuditService,
    ) {
        super();
        
        // Handle graceful shutdown
        process.on('SIGTERM', () => this.gracefulShutdown());
        process.on('SIGINT', () => this.gracefulShutdown());
    }

    async onModuleDestroy() {
        await this.gracefulShutdown();
    }

    private async gracefulShutdown() {
        if (this.isShuttingDown) return;
        
        this.isShuttingDown = true;
        this.logger.log('Starting graceful shutdown of email processor...');
        
        // Wait for current jobs to complete (max 30 seconds)
        const maxWaitTime = 30000;
        const startTime = Date.now();
        
        while (Date.now() - startTime < maxWaitTime) {
            const activeJobs = await this.getActiveJobs();
            if (activeJobs.length === 0) {
                break;
            }
            
            this.logger.log(`Waiting for ${activeJobs.length} active jobs to complete...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        this.logger.log('Email processor shutdown complete');
    }

    private async getActiveJobs() {
        // This would need to be implemented based on your BullMQ setup
        return [];
    }

    async process(job: Job<EmailJobData>): Promise<any> {
        // Check if we're shutting down
        if (this.isShuttingDown) {
            throw new Error('Email processor is shutting down, job rejected');
        }

        const { to, subject, template, templateData, attachments } = job.data;
        const startTime = Date.now();

        this.logger.log(
            `Processing email job: ${job.data.jobId} to ${Array.isArray(to) ? to.join(', ') : to}`,
        );

        try {
            // Update job status to processing
            await this.jobAuditService.updateJobStatus(job.data.jobId, 'processing');

            // Set job timeout (5 minutes)
            const timeout = setTimeout(() => {
                throw new Error('Email job timeout after 5 minutes');
            }, 5 * 60 * 1000);

            await job.updateProgress(10);

            // Validate email data
            this.validateEmailData(job.data);

            await job.updateProgress(20);

            // Get email template
            const emailTemplate = this.emailService.getEmailTemplate(template, templateData);

            await job.updateProgress(40);

            // Send email with retry logic
            const result = await this.sendEmailWithRetry(
                to,
                subject || emailTemplate.subject,
                emailTemplate.html,
                emailTemplate.text,
                attachments,
            );

            clearTimeout(timeout);

            await job.updateProgress(100);

            const duration = Date.now() - startTime;
            this.logger.log(
                `Email sent successfully: ${job.data.jobId} in ${duration}ms`,
            );

            const jobResult = {
                success: true,
                messageId: result.messageId,
                recipients: Array.isArray(to) ? to : [to],
                duration,
                timestamp: new Date().toISOString(),
            };

            // Update job status to completed
            await this.jobAuditService.updateJobStatus(job.data.jobId, 'completed', jobResult);

            return jobResult;
        } catch (error) {
            const jobError: JobError = {
                message: error.message,
                stack: error.stack,
                timestamp: new Date(),
                attemptNumber: job.attemptsMade,
                jobId: job.data.jobId,
            };

            this.logger.error(`Email job failed: ${job.data.jobId}`, {
                error: jobError,
                jobData: job.data,
            });

            // Update job status to failed
            await this.jobAuditService.updateJobStatus(job.data.jobId, 'failed', null, error.message);

            // Log to dead letter queue for manual review
            await this.logToDeadLetterQueue(job, jobError);

            throw error;
        }
    }

    private validateEmailData(data: EmailJobData): void {
        if (!data.to || (Array.isArray(data.to) && data.to.length === 0)) {
            throw new Error('Email recipient is required');
        }

        if (!data.template) {
            throw new Error('Email template is required');
        }

        // Validate email addresses
        const recipients = Array.isArray(data.to) ? data.to : [data.to];
        for (const email of recipients) {
            if (!this.isValidEmail(email)) {
                throw new Error(`Invalid email address: ${email}`);
            }
        }
    }

    private isValidEmail(email: string): boolean {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    private async sendEmailWithRetry(
        to: string | string[],
        subject: string,
        html: string,
        text?: string,
        attachments?: any[],
        maxRetries: number = 3,
    ): Promise<any> {
        let lastError: Error = new Error('Unknown error');

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await this.emailService.sendEmail(to, subject, html, text, attachments);
            } catch (error) {
                lastError = error as Error;
                this.logger.warn(`Email send attempt ${attempt} failed:`, error.message);

                if (attempt < maxRetries) {
                    // Exponential backoff: 1s, 2s, 4s
                    const delay = Math.pow(2, attempt - 1) * 1000;
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        throw lastError;
    }

    private async logToDeadLetterQueue(job: Job<EmailJobData>, error: JobError): Promise<void> {
        try {
            // In a real implementation, you'd store this in a dead letter queue
            // For now, just log it for manual review
            this.logger.error('DEAD LETTER QUEUE - Email job failed permanently:', {
                jobId: job.data.jobId,
                error,
                jobData: job.data,
                failedAt: new Date().toISOString(),
            });

            // TODO: Store in database or Redis for manual review
            // await this.deadLetterQueue.add('failed-email', { job, error });
        } catch (logError) {
            this.logger.error('Failed to log to dead letter queue:', logError);
        }
    }

    // Handle job completion
    async onCompleted(job: Job<EmailJobData>, result: any): Promise<void> {
        this.logger.log(`Email job completed successfully: ${job.data.jobId}`);
    }

    // Handle job failure
    async onFailed(job: Job<EmailJobData>, error: Error): Promise<void> {
        this.logger.error(`Email job failed permanently: ${job.data.jobId}`, error);
        
        // Send alert for critical email failures
        if (job.data.priority === 'critical') {
            await this.sendFailureAlert(job, error);
        }
    }

    private async sendFailureAlert(job: Job<EmailJobData>, error: Error): Promise<void> {
        try {
            // Send alert to admin about critical email failure
            this.logger.error('CRITICAL EMAIL FAILURE ALERT:', {
                jobId: job.data.jobId,
                recipients: job.data.to,
                subject: job.data.subject,
                error: error.message,
                timestamp: new Date().toISOString(),
            });

            // Send alert email to admin
            await this.emailService.sendEmail(
                process.env.ADMIN_EMAIL || 'admin@genie-ai.com',
                '🚨 Critical Email Failure Alert',
                `
                <h2>Critical Email Failure</h2>
                <p><strong>Job ID:</strong> ${job.data.jobId}</p>
                <p><strong>Recipients:</strong> ${Array.isArray(job.data.to) ? job.data.to.join(', ') : job.data.to}</p>
                <p><strong>Subject:</strong> ${job.data.subject}</p>
                <p><strong>Error:</strong> ${error.message}</p>
                <p><strong>Time:</strong> ${new Date().toISOString()}</p>
                `,
                `Critical Email Failure - Job ${job.data.jobId} failed: ${error.message}`
            );
        } catch (alertError) {
            this.logger.error('Failed to send failure alert:', alertError);
        }
    }
}