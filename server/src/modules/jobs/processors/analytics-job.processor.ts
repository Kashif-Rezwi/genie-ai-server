import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AnalyticsJobData } from '../interfaces/job.interface';
import { QUEUE_NAMES } from '../constants/queue-names';
import { AnalyticsJobService } from '../services/analytics-job.service';
import { RedisService } from '../../../modules/redis/redis.service';

@Processor(QUEUE_NAMES.ANALYTICS)
export class AnalyticsJobProcessor extends WorkerHost {
    private readonly logger = new Logger(AnalyticsJobProcessor.name);

    constructor(
        private readonly analyticsJobService: AnalyticsJobService,
        private readonly redisService: RedisService,
    ) {
        super();
    }

    async process(job: Job<AnalyticsJobData>): Promise<any> {
        const { type } = job.data;

        this.logger.log(`Processing analytics job: ${job.data.jobId} (${type})`);

        try {
            await job.updateProgress(10);

            let metrics: any;

            switch (type) {
                case 'daily':
                    metrics = await this.analyticsJobService.generateDailyMetrics();
                    break;
                case 'weekly':
                    metrics = await this.analyticsJobService.generateWeeklyMetrics();
                    break;
                case 'monthly':
                    metrics = await this.analyticsJobService.generateMonthlyMetrics();
                    break;
                default:
                    throw new Error(`Unknown analytics type: ${type}`);
            }

            await job.updateProgress(80);

            // Store results in Redis
            const key = `analytics:${type}:${new Date().toISOString().slice(0, 10)}`;
            await this.redisService.set(key, JSON.stringify(metrics), 86400);

            await job.updateProgress(100);

            return {
                success: true,
                type,
                metrics,
                timestamp: new Date().toISOString(),
            };

        } catch (error) {
            this.logger.error(`Analytics job failed: ${job.data.jobId}`, error);
            throw error;
        }
    }
}
