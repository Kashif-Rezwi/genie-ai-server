import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { JobsController } from './jobs.controller';
import { JobService } from './services/job.service';
import { EmailService } from './services/email.service';
import { AnalyticsJobService } from './services/analytics-job.service';
import { MaintenanceJobService } from './services/maintenance-job.service';
import { AIJobProcessor } from './processors/ai-job.processor';
import { PaymentJobProcessor } from './processors/payment-job.processor';
import { EmailJobProcessor } from './processors/email-job.processor';
import { AnalyticsJobProcessor } from './processors/analytics-job.processor';
import { MaintenanceJobProcessor } from './processors/maintenance-job.processor';
import { CreditsModule } from '../credits/credits.module';
import { PaymentsModule } from '../payments/payments.module';
import { SecurityModule } from '../security/security.module';
import { AIModule } from '../ai/ai.module';
import { ChatModule } from '../chat/chat.module';
import { User, Chat, Message, Payment, CreditTransaction } from '../../entities';
import { redisConfig } from '../../config';
import { QUEUE_NAMES } from './constants/queue-names';

const config = redisConfig();

@Module({
    imports: [
        ScheduleModule.forRoot(),
        TypeOrmModule.forFeature([User, Chat, Message, Payment, CreditTransaction]),
        BullModule.forRoot({
            connection: {
                host: config.host,
                port: config.port,
                password: config.password,
                db: config.jobsDb, // Separate DB for jobs
            },
            defaultJobOptions: {
                removeOnComplete: 50, // Keep last 50 completed jobs
                removeOnFail: 20,     // Keep last 20 failed jobs
                attempts: 3,          // Retry failed jobs 3 times
                backoff: {
                    type: 'exponential',
                    delay: 2000,        // Start with 2s delay
                },
            },
        }),
        BullModule.registerQueue(
            { name: QUEUE_NAMES.AI_PROCESSING },
            { name: QUEUE_NAMES.PAYMENT_PROCESSING },
            { name: QUEUE_NAMES.EMAIL_NOTIFICATIONS },
            { name: QUEUE_NAMES.ANALYTICS },
            { name: QUEUE_NAMES.MAINTENANCE },
        ),
        CreditsModule,
        PaymentsModule,
        SecurityModule,
        AIModule,
        ChatModule,
    ],
    controllers: [JobsController],
    providers: [
        JobService,
        EmailService,
        AnalyticsJobService,
        MaintenanceJobService,
        AIJobProcessor,
        PaymentJobProcessor,
        EmailJobProcessor,
        AnalyticsJobProcessor,
        MaintenanceJobProcessor,
    ],
    exports: [
        JobService,
        EmailService,
        AnalyticsJobService,
        MaintenanceJobService,
    ],
})
export class JobsModule { }