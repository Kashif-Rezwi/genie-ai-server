import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailJobData } from '../interfaces/job.interface';
import { JobAudit } from '../../../entities';

@Injectable()
export class JobAuditService {
    private readonly logger = new Logger(JobAuditService.name);

    constructor(
        @InjectRepository(JobAudit)
        private readonly jobAuditRepository: Repository<JobAudit>,
    ) {}

    async createJobAudit(jobData: EmailJobData, type: string = 'email'): Promise<JobAudit> {
        const audit = this.jobAuditRepository.create({
            jobId: jobData.jobId,
            userId: jobData.userId,
            type: type as any,
            status: 'pending',
            data: jobData,
            attempts: 0,
        });

        return this.jobAuditRepository.save(audit);
    }

    async updateJobStatus(
        jobId: string, 
        status: JobAudit['status'], 
        result?: any, 
        error?: string
    ): Promise<void> {
        const audit = await this.jobAuditRepository.findOne({ where: { jobId } });
        if (!audit) {
            this.logger.warn(`Job audit not found for jobId: ${jobId}`);
            return;
        }

        audit.status = status;
        audit.updatedAt = new Date();
        audit.attempts += 1;

        if (result) {
            audit.result = result;
        }

        if (error) {
            audit.error = error;
        }

        if (status === 'completed') {
            audit.completedAt = new Date();
        } else if (status === 'failed') {
            audit.failedAt = new Date();
        }

        await this.jobAuditRepository.save(audit);
    }

    async getJobAudit(jobId: string): Promise<JobAudit | null> {
        return this.jobAuditRepository.findOne({ where: { jobId } });
    }

    async getJobHistory(userId?: string, limit: number = 50): Promise<JobAudit[]> {
        const query = this.jobAuditRepository.createQueryBuilder('audit')
            .orderBy('audit.createdAt', 'DESC')
            .limit(limit);

        if (userId) {
            query.where('audit.userId = :userId', { userId });
        }

        return query.getMany();
    }

    async getFailedJobs(limit: number = 20): Promise<JobAudit[]> {
        return this.jobAuditRepository.find({
            where: { status: 'failed' },
            order: { failedAt: 'DESC' },
            take: limit,
        });
    }

    async cleanupOldAudits(olderThanDays: number = 30): Promise<number> {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

        const result = await this.jobAuditRepository
            .createQueryBuilder()
            .delete()
            .where('createdAt < :cutoffDate', { cutoffDate })
            .execute();

        return result.affected || 0;
    }
}
