import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job, JobsOptions } from 'bullmq';
import {
    AIJobData,
    PaymentJobData,
    EmailJobData,
    AnalyticsJobData,
    MaintenanceJobData,
    JobPriority,
} from '../interfaces/job.interface';
import { QUEUE_NAMES } from '../constants/queue-names';

@Injectable()
export class JobService {
    private readonly logger = new Logger(JobService.name);

    constructor(
        @InjectQueue(QUEUE_NAMES.AI_PROCESSING)
        private readonly aiQueue: Queue<AIJobData>,

        @InjectQueue(QUEUE_NAMES.PAYMENT_PROCESSING)
        private readonly paymentQueue: Queue<PaymentJobData>,

        @InjectQueue(QUEUE_NAMES.EMAIL_NOTIFICATIONS)
        private readonly emailQueue: Queue<EmailJobData>,

        @InjectQueue(QUEUE_NAMES.ANALYTICS)
        private readonly analyticsQueue: Queue<AnalyticsJobData>,

        @InjectQueue(QUEUE_NAMES.MAINTENANCE)
        private readonly maintenanceQueue: Queue<MaintenanceJobData>,
    ) {}

    // AI Processing Jobs
    async addAIProcessingJob(
        data: Omit<AIJobData, 'jobId' | 'createdAt'>,
        options: Partial<JobsOptions> = {},
    ): Promise<Job<AIJobData>> {
        const jobData: AIJobData = {
            ...data,
            jobId: this.generateJobId('ai'),
            createdAt: new Date(),
        };

        const jobOptions: JobsOptions = {
            priority: options.priority || JobPriority.NORMAL,
            delay: options.delay || 0,
            attempts: options.attempts || 3,
            backoff: options.backoff || {
                type: 'exponential',
                delay: 2000,
            },
            removeOnComplete: 10,
            removeOnFail: 5,
            ...options,
        };

        this.logger.log(`Adding AI processing job: ${jobData.jobId}`);
        return this.aiQueue.add('process-ai-request', jobData, jobOptions);
    }

    async addLongRunningAIJob(
        data: Omit<AIJobData, 'jobId' | 'createdAt'>,
        estimatedDuration: number = 60000, // 1 minute default
    ): Promise<Job<AIJobData>> {
        return this.addAIProcessingJob(data, {
            priority: JobPriority.HIGH,
            attempts: 5,
            backoff: {
                type: 'exponential',
                delay: 5000,
            },
            removeOnComplete: 20,
            removeOnFail: 10,
        });
    }

    // Payment Processing Jobs
    async addPaymentProcessingJob(
        data: Omit<PaymentJobData, 'jobId' | 'createdAt'>,
        options: Partial<JobsOptions> = {},
    ): Promise<Job<PaymentJobData>> {
        const jobData: PaymentJobData = {
            ...data,
            jobId: this.generateJobId('payment'),
            createdAt: new Date(),
        };

        const jobOptions: JobsOptions = {
            priority: JobPriority.HIGH,
            attempts: 5,
            backoff: {
                type: 'exponential',
                delay: 1000,
            },
            removeOnComplete: 50,
            removeOnFail: 20,
            ...options,
        };

        this.logger.log(`Adding payment processing job: ${jobData.jobId}`);
        return this.paymentQueue.add(`payment-${data.action}`, jobData, jobOptions);
    }

    async addPaymentRetryJob(
        paymentId: string,
        userId: string,
        retryCount: number = 1,
    ): Promise<Job<PaymentJobData>> {
        const delay = Math.min(Math.pow(2, retryCount) * 1000, 300000); // Max 5 minutes

        return this.addPaymentProcessingJob(
            {
                paymentId,
                userId,
                action: 'retry',
                metadata: { retryCount },
            },
            {
                delay,
                priority: JobPriority.HIGH,
            },
        );
    }

    // Email Jobs
    async addEmailJob(
        data: Omit<EmailJobData, 'jobId' | 'createdAt'>,
        options: Partial<JobsOptions> = {},
    ): Promise<Job<EmailJobData>> {
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
        return this.emailQueue.add('send-email', jobData, jobOptions);
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

    // Analytics Jobs
    async addAnalyticsJob(
        data: Omit<AnalyticsJobData, 'jobId' | 'createdAt'>,
        options: Partial<JobsOptions> = {},
    ): Promise<Job<AnalyticsJobData>> {
        const jobData: AnalyticsJobData = {
            ...data,
            jobId: this.generateJobId('analytics'),
            createdAt: new Date(),
        };

        const jobOptions: JobsOptions = {
            priority: JobPriority.LOW,
            attempts: 2,
            removeOnComplete: 20,
            removeOnFail: 5,
            ...options,
        };

        this.logger.log(`Adding analytics job: ${jobData.jobId}`);
        return this.analyticsQueue.add(`analytics-${data.type}`, jobData, jobOptions);
    }

    // Maintenance Jobs
    async addMaintenanceJob(
        data: Omit<MaintenanceJobData, 'jobId' | 'createdAt'>,
        options: Partial<JobsOptions> = {},
    ): Promise<Job<MaintenanceJobData>> {
        const jobData: MaintenanceJobData = {
            ...data,
            jobId: this.generateJobId('maintenance'),
            createdAt: new Date(),
        };

        const jobOptions: JobsOptions = {
            priority: JobPriority.LOW,
            attempts: 2,
            removeOnComplete: 10,
            removeOnFail: 5,
            ...options,
        };

        this.logger.log(`Adding maintenance job: ${jobData.jobId}`);
        return this.maintenanceQueue.add(`maintenance-${data.task}`, jobData, jobOptions);
    }

    // Job Status and Management
    async getJobStatus(queueName: string, jobId: string): Promise<any> {
        const queue = this.getQueueByName(queueName);
        const job = await queue.getJob(jobId);

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

    async getQueueStats(queueName: string): Promise<{
        waiting: number;
        active: number;
        completed: number;
        failed: number;
        delayed: number;
        paused: number;
    }> {
        const queue = this.getQueueByName(queueName);
        return queue.getJobCounts() as any;
    }

    async getAllQueueStats(): Promise<Record<string, any>> {
        const stats: Record<string, any> = {};

        for (const queueName of Object.values(QUEUE_NAMES)) {
            stats[queueName] = await this.getQueueStats(queueName);
        }

        return stats;
    }

    async pauseQueue(queueName: string): Promise<void> {
        const queue = this.getQueueByName(queueName);
        await queue.pause();
        this.logger.log(`Queue paused: ${queueName}`);
    }

    async resumeQueue(queueName: string): Promise<void> {
        const queue = this.getQueueByName(queueName);
        await queue.resume();
        this.logger.log(`Queue resumed: ${queueName}`);
    }

    async retryFailedJobs(queueName: string, limit: number = 10): Promise<number> {
        const queue = this.getQueueByName(queueName);
        const failedJobs = await queue.getFailed(0, limit - 1);

        let retriedCount = 0;
        for (const job of failedJobs) {
            try {
                await job.retry();
                retriedCount++;
            } catch (error) {
                this.logger.error(`Failed to retry job ${job.id}:`, error);
            }
        }

        this.logger.log(`Retried ${retriedCount} failed jobs in queue: ${queueName}`);
        return retriedCount;
    }

    // Scheduled Jobs
    async addScheduledJob(
        queueName: string,
        jobName: string,
        data: any,
        cronExpression: string,
    ): Promise<Job> {
        const queue = this.getQueueByName(queueName);

        return queue.add(jobName, data, {
            repeat: {
                pattern: cronExpression,
            },
            removeOnComplete: 5,
            removeOnFail: 3,
        });
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

    private getQueueByName(queueName: string): Queue {
        switch (queueName) {
            case QUEUE_NAMES.AI_PROCESSING:
                return this.aiQueue;
            case QUEUE_NAMES.PAYMENT_PROCESSING:
                return this.paymentQueue;
            case QUEUE_NAMES.EMAIL_NOTIFICATIONS:
                return this.emailQueue;
            case QUEUE_NAMES.ANALYTICS:
                return this.analyticsQueue;
            case QUEUE_NAMES.MAINTENANCE:
                return this.maintenanceQueue;
            default:
                throw new Error(`Unknown queue: ${queueName}`);
        }
    }
}
