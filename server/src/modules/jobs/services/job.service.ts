import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job, JobsOptions } from 'bullmq';
import { EmailJobData, JobPriority } from '../interfaces/job.interface';
import { QUEUE_NAMES } from '../constants/queue-names';
import { RedisService } from '../../redis/redis.service';
import { JobAuditService } from './job-audit.service';

@Injectable()
export class JobService {
    private readonly logger = new Logger(JobService.name);

    constructor(
        @InjectQueue(QUEUE_NAMES.EMAIL_NOTIFICATIONS)
        private readonly emailQueue: Queue<EmailJobData>,
        private readonly redisService: RedisService,
        private readonly jobAuditService: JobAuditService,
    ) {}

    // Email Jobs - Core functionality for 0-1000 users
    async addEmailJob(
        data: Omit<EmailJobData, 'jobId' | 'createdAt'>,
        options: Partial<JobsOptions> = {},
    ): Promise<Job<EmailJobData>> {
        // Rate limiting check
        if (data.userId) {
            const isRateLimited = await this.checkRateLimit(data.userId);
            if (isRateLimited) {
                throw new Error('Rate limit exceeded. Please try again later.');
            }
        }

        // Job deduplication
        const duplicateKey = this.generateDuplicateKey(data);
        const existingJob = await this.checkForDuplicate(duplicateKey);
        if (existingJob) {
            this.logger.warn(`Duplicate email job detected: ${duplicateKey}`);
            return existingJob;
        }

        const jobData: EmailJobData = {
            ...data,
            jobId: this.generateJobId('email'),
            createdAt: new Date(),
        };

        const priority = this.getEmailPriority(data.priority);
        const jobOptions: JobsOptions = {
            priority,
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 5000,
            },
            removeOnComplete: 30,
            removeOnFail: 10,
            ...options,
        };

        this.logger.log(`Adding email job: ${jobData.jobId} (${data.priority})`);
        const job = await this.emailQueue.add('send-email', jobData, jobOptions);
        
        // Store duplicate key for deduplication
        await this.storeDuplicateKey(duplicateKey, job.id!);
        
        // Create job audit record
        await this.jobAuditService.createJobAudit(jobData, 'email');
        
        return job;
    }

    async addBulkEmailJob(
        emails: Array<Omit<EmailJobData, 'jobId' | 'createdAt'>>,
        batchSize: number = 10,
    ): Promise<Job<EmailJobData>[]> {
        const jobs: Job<EmailJobData>[] = [];

        for (let i = 0; i < emails.length; i += batchSize) {
            const batch = emails.slice(i, i + batchSize);

            for (const email of batch) {
                const job = await this.addEmailJob(email, {
                    delay: Math.floor(i / batchSize) * 2000, // Stagger batches by 2 seconds
                });
                jobs.push(job);
            }
        }

        return jobs;
    }

    // Job Status and Management - Essential for production
    async getJobStatus(jobId: string): Promise<any> {
        const job = await this.emailQueue.getJob(jobId);
        if (!job) {
            return null;
        }

        return {
            id: job.id,
            name: job.name,
            data: job.data,
            progress: job.progress,
            finishedOn: job.finishedOn,
            processedOn: job.processedOn,
            failedReason: job.failedReason,
            stacktrace: job.stacktrace,
            opts: job.opts,
            attemptsMade: job.attemptsMade,
            delay: job.delay,
        };
    }

    async pauseQueue(): Promise<void> {
        await this.emailQueue.pause();
        this.logger.log('Email queue paused');
    }

    async resumeQueue(): Promise<void> {
        await this.emailQueue.resume();
        this.logger.log('Email queue resumed');
    }

    async retryFailedJobs(limit: number = 10): Promise<number> {
        const failedJobs = await this.emailQueue.getFailed(0, limit - 1);

        let retriedCount = 0;
        for (const job of failedJobs) {
            try {
                await job.retry();
                retriedCount++;
            } catch (error) {
                this.logger.error(`Failed to retry job ${job.id}:`, error);
            }
        }

        this.logger.log(`Retried ${retriedCount} failed email jobs`);
        return retriedCount;
    }

    // Scheduled Jobs - For future scaling
    async addScheduledEmailJob(
        data: Omit<EmailJobData, 'jobId' | 'createdAt'>,
        cronExpression: string,
    ): Promise<Job> {
        const jobData: EmailJobData = {
            ...data,
            jobId: this.generateJobId('email-scheduled'),
            createdAt: new Date(),
        };

        return this.emailQueue.add('send-email', jobData, {
            repeat: {
                pattern: cronExpression,
            },
            removeOnComplete: 5,
            removeOnFail: 3,
        });
    }

    // Queue Statistics - Essential for monitoring
    async getQueueStats(): Promise<any> {
        const counts = await this.emailQueue.getJobCounts();
        return {
            waiting: counts.waiting,
            active: counts.active,
            completed: counts.completed,
            failed: counts.failed,
            delayed: counts.delayed,
            paused: counts.paused,
            lastUpdated: new Date(),
        };
    }

    // Helper Methods
    private generateJobId(prefix: string): string {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private getEmailPriority(priority: string): number {
        const priorities: Record<string, number> = {
            low: JobPriority.LOW,
            normal: JobPriority.NORMAL,
            high: JobPriority.HIGH,
            critical: JobPriority.CRITICAL,
        };
        return priorities[priority] || JobPriority.NORMAL;
    }

    // Rate limiting - 10 emails per minute per user
    private async checkRateLimit(userId: string): Promise<boolean> {
        const key = `email_rate_limit:${userId}`;
        const current = await this.redisService.get(key);
        
        if (!current) {
            await this.redisService.set(key, '1', 60); // 1 minute TTL
            return false;
        }
        
        const count = parseInt(current);
        if (count >= 10) {
            return true; // Rate limited
        }
        
        await this.redisService.set(key, (count + 1).toString(), 60);
        return false;
    }

    // Job deduplication
    private generateDuplicateKey(data: Omit<EmailJobData, 'jobId' | 'createdAt'>): string {
        const key = `${data.template}:${Array.isArray(data.to) ? data.to.join(',') : data.to}:${JSON.stringify(data.templateData)}`;
        return `email_duplicate:${Buffer.from(key).toString('base64')}`;
    }

    private async checkForDuplicate(duplicateKey: string): Promise<Job<EmailJobData> | null> {
        const jobId = await this.redisService.get(duplicateKey);
        if (!jobId) {
            return null;
        }
        
        const job = await this.emailQueue.getJob(jobId);
        return job || null;
    }

    private async storeDuplicateKey(duplicateKey: string, jobId: string): Promise<void> {
        await this.redisService.set(duplicateKey, jobId, 3600); // 1 hour TTL
    }
}