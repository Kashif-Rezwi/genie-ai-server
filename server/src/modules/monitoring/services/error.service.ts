import { Injectable } from '@nestjs/common';
import { LoggingService } from './logging.service';
import { EmailService } from '../../email/email.service';

@Injectable()
export class ErrorService {
    constructor(
        private readonly loggingService: LoggingService,
        private readonly emailService?: EmailService,
    ) {}

    captureError(error: Error, context?: any): void {
        // Log the error
        this.loggingService.logError('Application Error', error, context);

        // Send email for critical errors only
        if (this.isCritical(error)) {
            this.sendEmailAlert(error, context);
        }
    }

    captureException(message: string, context?: any): void {
        const error = new Error(message);
        this.captureError(error, context);
    }

    private isCritical(error: Error): boolean {
        const errorName = error.constructor.name.toLowerCase();
        const message = error.message.toLowerCase();

        return (
            errorName.includes('outofmemory') ||
            message.includes('database') ||
            message.includes('redis') ||
            message.includes('payment') ||
            message.includes('security')
        );
    }

    private async sendEmailAlert(error: Error, context?: any): Promise<void> {
        if (!this.emailService) {
            this.loggingService.logWarning('Email service not available for error alerts');
            return;
        }

        try {
            await this.emailService.sendAlertEmail(
                process.env.ERROR_NOTIFICATION_EMAIL || 'admin@genie-ai.com',
                {
                    title: 'Critical Error Alert',
                    message: `Error: ${error.message}\nStack: ${error.stack}\nContext: ${JSON.stringify(context, null, 2)}`,
                    severity: 'critical',
                    timestamp: new Date().toISOString(),
                    data: { error: error.message, context },
                    id: `error_${Date.now()}`,
                }
            );
        } catch (emailError) {
            this.loggingService.logError('Failed to send error alert email', emailError);
        }
    }
}
