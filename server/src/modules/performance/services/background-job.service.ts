import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { Cron, CronExpression } from '@nestjs/schedule';

export interface Job<T = any> {
  id: string;
  type: string;
  data: T;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
  processedAt?: Date;
  retryCount: number;
  error?: string;
}

export type JobProcessor<T = any> = (data: T) => Promise<void>;

/**
 * Simplified background job service for MVP
 * Provides essential job processing without over-engineering
 */
@Injectable()
export class BackgroundJobService {
  private readonly logger = new Logger(BackgroundJobService.name);
  private readonly jobQueue = 'jobs:pending';
  private readonly completedQueue = 'jobs:completed';
  private readonly failedQueue = 'jobs:failed';
  private readonly processors = new Map<string, JobProcessor>();

  constructor(@InjectRedis() private readonly redis: Redis) {}

  /**
   * Register a job processor
   * @param jobType - Type of job to process
   * @param processor - Function to process the job
   */
  registerProcessor<T>(jobType: string, processor: JobProcessor<T>): void {
    this.processors.set(jobType, processor);
    this.logger.log(`Registered processor for job type: ${jobType}`);
  }

  /**
   * Add a job to the queue
   * @param jobType - Type of job
   * @param data - Job data
   * @returns Promise<string> - Job ID
   */
  async addJob<T>(jobType: string, data: T): Promise<string> {
    const jobId = this.generateJobId();
    const job: Job<T> = {
      id: jobId,
      type: jobType,
      data,
      status: 'pending',
      createdAt: new Date(),
      retryCount: 0,
    };

    try {
      // Store job data with 1 hour TTL
      await this.redis.setex(`job:${jobId}`, 3600, JSON.stringify(job));

      // Add to pending queue
      await this.redis.lpush(this.jobQueue, jobId);

      this.logger.debug(`Job ${jobId} added to queue`);
      return jobId;
    } catch (error) {
      this.logger.error(`Failed to add job ${jobId}:`, error);
      throw error;
    }
  }

  /**
   * Process jobs from the queue (called by cron)
   */
  @Cron(CronExpression.EVERY_10_SECONDS)
  async processJobs(): Promise<void> {
    try {
      // Process up to 5 jobs per batch
      const jobIds = await this.redis.lrange(this.jobQueue, 0, 4);

      for (const jobId of jobIds) {
        await this.processJob(jobId);
      }
    } catch (error) {
      this.logger.error('Error processing jobs:', error);
    }
  }

  /**
   * Get job status
   * @param jobId - Job ID
   * @returns Promise<Job | null> - Job details or null
   */
  async getJobStatus(jobId: string): Promise<Job | null> {
    try {
      const jobData = await this.redis.get(`job:${jobId}`);
      return jobData ? JSON.parse(jobData) : null;
    } catch (error) {
      this.logger.warn(`Failed to get job status for ${jobId}:`, error);
      return null;
    }
  }

  /**
   * Get job statistics
   * @returns Promise<object> - Job statistics
   */
  async getJobStats(): Promise<{
    pending: number;
    completed: number;
    failed: number;
    total: number;
  }> {
    try {
      const [pending, completed, failed] = await Promise.all([
        this.redis.llen(this.jobQueue),
        this.redis.llen(this.completedQueue),
        this.redis.llen(this.failedQueue),
      ]);

      return {
        pending,
        completed,
        failed,
        total: pending + completed + failed,
      };
    } catch (error) {
      this.logger.warn('Failed to get job stats:', error);
      return { pending: 0, completed: 0, failed: 0, total: 0 };
    }
  }

  /**
   * Clean up old completed and failed jobs (daily)
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanupOldJobs(): Promise<void> {
    try {
      const cutoffTime = Date.now() - 24 * 60 * 60 * 1000; // 24 hours ago

      // Clean up completed jobs
      await this.cleanupQueue(this.completedQueue, cutoffTime);

      // Clean up failed jobs
      await this.cleanupQueue(this.failedQueue, cutoffTime);

      this.logger.log('Old jobs cleaned up successfully');
    } catch (error) {
      this.logger.error('Failed to cleanup old jobs:', error);
    }
  }

  /**
   * Process a single job
   * @param jobId - Job ID
   */
  private async processJob(jobId: string): Promise<void> {
    try {
      // Get job data
      const jobData = await this.redis.get(`job:${jobId}`);
      if (!jobData) {
        await this.redis.lrem(this.jobQueue, 0, jobId);
        return;
      }

      const job: Job = JSON.parse(jobData);

      // Check if processor exists
      const processor = this.processors.get(job.type);
      if (!processor) {
        this.logger.warn(`No processor found for job type: ${job.type}`);
        await this.moveJobToQueue(jobId, this.failedQueue);
        return;
      }

      // Update job status to processing
      job.status = 'processing';
      job.processedAt = new Date();
      await this.redis.setex(`job:${jobId}`, 3600, JSON.stringify(job));

      // Process the job
      await processor(job.data);

      // Move to completed queue
      job.status = 'completed';
      await this.redis.setex(`job:${jobId}`, 3600, JSON.stringify(job));
      await this.moveJobToQueue(jobId, this.completedQueue);

      this.logger.debug(`Job ${jobId} completed successfully`);
    } catch (error) {
      await this.handleJobError(jobId, error);
    }
  }

  /**
   * Handle job processing error
   * @param jobId - Job ID
   * @param error - Error object
   */
  private async handleJobError(jobId: string, error: any): Promise<void> {
    try {
      const jobData = await this.redis.get(`job:${jobId}`);
      if (!jobData) return;

      const job: Job = JSON.parse(jobData);
      job.retryCount++;
      job.error = error.message;

      // Simple retry logic: retry up to 3 times
      if (job.retryCount < 3) {
        job.status = 'pending';
        await this.redis.setex(`job:${jobId}`, 3600, JSON.stringify(job));

        // Add back to queue with delay
        setTimeout(() => {
          this.redis.lpush(this.jobQueue, jobId);
        }, job.retryCount * 5000); // 5s, 10s, 15s delays

        this.logger.warn(`Job ${jobId} failed, retrying (${job.retryCount}/3):`, error);
      } else {
        // Max retries exceeded, move to failed queue
        job.status = 'failed';
        await this.redis.setex(`job:${jobId}`, 3600, JSON.stringify(job));
        await this.moveJobToQueue(jobId, this.failedQueue);

        this.logger.error(
          `Job ${jobId} failed permanently after ${job.retryCount} retries:`,
          error
        );
      }
    } catch (cleanupError) {
      this.logger.error(`Failed to handle job error for ${jobId}:`, cleanupError);
    }
  }

  /**
   * Move job between queues
   * @param jobId - Job ID
   * @param targetQueue - Target queue
   */
  private async moveJobToQueue(jobId: string, targetQueue: string): Promise<void> {
    // Remove from pending queue
    await this.redis.lrem(this.jobQueue, 0, jobId);

    // Add to target queue
    await this.redis.lpush(targetQueue, jobId);
  }

  /**
   * Generate unique job ID
   * @returns string - Job ID
   */
  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clean up old jobs from a queue
   * @param queue - Queue name
   * @param cutoffTime - Cutoff timestamp
   */
  private async cleanupQueue(queue: string, cutoffTime: number): Promise<void> {
    try {
      const jobs = await this.redis.lrange(queue, 0, -1);
      for (const jobId of jobs) {
        const jobData = await this.redis.get(`job:${jobId}`);
        if (jobData) {
          const job: Job = JSON.parse(jobData);
          if (job.createdAt.getTime() < cutoffTime) {
            await this.redis.lrem(queue, 0, jobId);
            await this.redis.del(`job:${jobId}`);
          }
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to cleanup queue ${queue}:`, error);
    }
  }
}
