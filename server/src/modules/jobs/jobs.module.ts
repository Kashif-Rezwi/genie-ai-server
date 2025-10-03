import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobsController } from './jobs.controller';
import { JobService } from './services/job.service';
import { EmailService } from './services/email.service';
import { JobAuditService } from './services/job-audit.service';
import { EmailJobProcessor } from './processors/email-job.processor';
import { JobAudit } from '../../entities';
import { redisConfig } from '../../config';
import { QUEUE_NAMES } from './constants/queue-names';

const config = redisConfig();

@Module({
    imports: [
        TypeOrmModule.forFeature([JobAudit]),
        BullModule.forRoot({
            connection: {
                host: config.host,
                port: config.port,
                password: config.password,
                db: config.jobsDb, // Separate DB for jobs
            },
            defaultJobOptions: {
                removeOnComplete: 50, // Keep last 50 completed jobs
                removeOnFail: 20, // Keep last 20 failed jobs
                attempts: 3, // Retry failed jobs 3 times
                backoff: {
                    type: 'exponential',
                    delay: 2000, // Start with 2s delay
                },
            },
        }),
        // Email queue for MVP
        BullModule.registerQueue({
            name: QUEUE_NAMES.EMAIL_NOTIFICATIONS,
        }),
    ],
    controllers: [JobsController],
    providers: [
        // Core services for MVP
        JobService,
        EmailService,
        JobAuditService,
        EmailJobProcessor,
    ],
    exports: [
        JobService, 
        EmailService,
        JobAuditService
    ],
})
export class JobsModule {}