import { Injectable } from '@nestjs/common';
import { LoggingService } from './logging.service';
import { EmailService } from '../../email/email.service';
import { MetricsService } from './metrics.service';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class ErrorService {
    constructor(
        private readonly loggingService: LoggingService,
        private readonly metricsService: MetricsService,
        private readonly redisService: RedisService,
        private readonly emailService?: EmailService,
    ) {}

    captureError(error: Error, context?: any): void {
        const severity = this.determineSeverity(error);
        const endpoint = context?.endpoint || 'unknown';
        
        // Log the error with enhanced context
        this.loggingService.logError('Application Error', error, {
            ...context,
            severity,
            category: this.categorizeError(error),
        });

        // Record in metrics
        this.metricsService.recordError(error, endpoint, severity);

        // Store error details in Redis for analysis
        this.storeErrorDetails(error, context, severity);

        // Send email for critical errors only
        if (this.isCritical(error)) {
            this.sendEmailAlert(error, context);
        }

        // Track error patterns
        this.trackErrorPatterns(error, context);
    }

    captureException(message: string, context?: any): void {
        const error = new Error(message);
        this.captureError(error, context);
    }

    // Enhanced error tracking methods
    captureSecurityError(error: Error, context?: any): void {
        this.loggingService.logSecurity(`Security Error: ${error.message}`, {
            ...context,
            error: error.message,
            stack: error.stack,
        });
        
        this.metricsService.recordSuspiciousActivity();
        this.captureError(error, { ...context, category: 'security' });
    }

    capturePaymentError(error: Error, context?: any): void {
        this.loggingService.logError('Payment Error', error, {
            ...context,
            category: 'payment',
            severity: 'high',
        });
        
        this.metricsService.recordError(error, context?.endpoint || 'payment', 'high');
        this.captureError(error, { ...context, category: 'payment' });
    }

    captureDatabaseError(error: Error, context?: any): void {
        this.loggingService.logError('Database Error', error, {
            ...context,
            category: 'database',
            severity: 'high',
        });
        
        this.metricsService.recordError(error, context?.endpoint || 'database', 'high');
        this.captureError(error, { ...context, category: 'database' });
    }

    // Error analysis methods
    async getErrorTrends(timeWindow: number = 3600): Promise<{
        totalErrors: number;
        errorsByType: Record<string, number>;
        errorsByEndpoint: Record<string, number>;
        criticalErrors: number;
        recentErrors: Array<{
            timestamp: Date;
            message: string;
            type: string;
            severity: string;
            endpoint: string;
        }>;
    }> {
        try {
            const keys = await this.redisService.keys('error:*');
            const now = Date.now();
            const cutoff = now - (timeWindow * 1000);
            
            const errors: any[] = [];
            for (const key of keys) {
                const errorData = await this.redisService.get(key);
                if (errorData) {
                    const error = JSON.parse(errorData);
                    if (error.timestamp > cutoff) {
                        errors.push(error);
                    }
                }
            }

            const totalErrors = errors.length;
            const errorsByType: Record<string, number> = {};
            const errorsByEndpoint: Record<string, number> = {};
            let criticalErrors = 0;

            errors.forEach(error => {
                errorsByType[error.type] = (errorsByType[error.type] || 0) + 1;
                errorsByEndpoint[error.endpoint] = (errorsByEndpoint[error.endpoint] || 0) + 1;
                if (error.severity === 'critical') criticalErrors++;
            });

            const recentErrors = errors
                .sort((a, b) => b.timestamp - a.timestamp)
                .slice(0, 20)
                .map(error => ({
                    timestamp: new Date(error.timestamp),
                    message: error.message,
                    type: error.type,
                    severity: error.severity,
                    endpoint: error.endpoint,
                }));

            return {
                totalErrors,
                errorsByType,
                errorsByEndpoint,
                criticalErrors,
                recentErrors,
            };
        } catch (error) {
            this.loggingService.logError('Failed to get error trends', error);
            return {
                totalErrors: 0,
                errorsByType: {},
                errorsByEndpoint: {},
                criticalErrors: 0,
                recentErrors: [],
            };
        }
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

    // Helper methods
    private determineSeverity(error: Error): 'low' | 'medium' | 'high' | 'critical' {
        const errorName = error.constructor.name.toLowerCase();
        const message = error.message.toLowerCase();
        
        if (errorName.includes('outofmemory') || message.includes('database connection')) {
            return 'critical';
        }
        if (message.includes('payment') || message.includes('security') || message.includes('auth')) {
            return 'high';
        }
        if (message.includes('timeout') || message.includes('rate limit')) {
            return 'medium';
        }
        return 'low';
    }

    private categorizeError(error: Error): string {
        const message = error.message.toLowerCase();
        
        if (message.includes('database') || message.includes('sql')) {
            return 'database';
        }
        if (message.includes('payment') || message.includes('razorpay')) {
            return 'payment';
        }
        if (message.includes('auth') || message.includes('jwt') || message.includes('token')) {
            return 'auth';
        }
        if (message.includes('security') || message.includes('csrf') || message.includes('rate limit')) {
            return 'security';
        }
        if (message.includes('ai') || message.includes('openai') || message.includes('anthropic')) {
            return 'ai';
        }
        return 'system';
    }

    private async storeErrorDetails(error: Error, context: any, severity: string): Promise<void> {
        try {
            const errorData = {
                id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                type: error.constructor.name,
                message: error.message,
                stack: error.stack,
                severity,
                category: this.categorizeError(error),
                endpoint: context?.endpoint || 'unknown',
                timestamp: Date.now(),
                context: {
                    userId: context?.userId,
                    ip: context?.ip,
                    userAgent: context?.userAgent,
                    ...context,
                },
            };

            const key = `error:${errorData.id}`;
            await this.redisService.set(key, JSON.stringify(errorData), 86400 * 7); // 7 days TTL
        } catch (storeError) {
            this.loggingService.logError('Failed to store error details', storeError);
        }
    }

    private trackErrorPatterns(error: Error, context: any): void {
        // Track error patterns for analysis
        const pattern = {
            type: error.constructor.name,
            message: error.message,
            endpoint: context?.endpoint || 'unknown',
            timestamp: Date.now(),
        };

        // Store pattern in Redis for analysis
        this.redisService.incr(`error_pattern:${pattern.type}:${pattern.endpoint}`);
    }
}
