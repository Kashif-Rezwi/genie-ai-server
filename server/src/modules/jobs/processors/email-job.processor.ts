import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EmailJobData } from '../interfaces/job.interface';
import { QUEUE_NAMES } from '../constants/queue-names';
import { EmailService } from '../services/email.service';

@Processor(QUEUE_NAMES.EMAIL_NOTIFICATIONS)
export class EmailJobProcessor extends WorkerHost {
    private readonly logger = new Logger(EmailJobProcessor.name);

    constructor(private readonly emailService: EmailService) {
        super();
    }

    async process(job: Job<EmailJobData>): Promise<any> {
        const { to, subject, template, templateData, attachments } = job.data;

        this.logger.log(`Sending email: ${job.data.jobId} to ${Array.isArray(to) ? to.join(', ') : to}`);

        try {
            await job.updateProgress(10);

            // Get email template
            const emailTemplate = this.emailService.getEmailTemplate(template, templateData);

            await job.updateProgress(30);

            // Send email
            const result = await this.emailService.sendEmail(
                to,
                subject || emailTemplate.subject,
                emailTemplate.html,
                emailTemplate.text,
                attachments
            );

            await job.updateProgress(100);

            return {
                success: true,
                messageId: result.messageId,
                recipients: Array.isArray(to) ? to : [to],
            };

        } catch (error) {
            this.logger.error(`Email sending failed: ${job.data.jobId}`, error);
            throw error;
        }
    }
}
