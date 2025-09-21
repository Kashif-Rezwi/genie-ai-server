import { Injectable } from '@nestjs/common';
import { LoggingService } from './logging.service';
import { MetricsService } from './metrics.service';
import { AlertingService } from './alerting.service';

export interface ErrorEvent {
    id: string;
    timestamp: Date;
    level: 'error' | 'warning' | 'critical';
    message: string;
    stack?: string;
    context: {
        userId?: string;
        requestId?: string;
        endpoint?: string;
        userAgent?: string;
        ip?: string;
        [key: string]: any;
    };
    fingerprint: string; // For error grouping
    count: number;
    firstSeen: Date;
    lastSeen: Date;
}

export interface ErrorSummary {
    totalErrors: number;
    errorRate: number;
    topErrors: Array<{
        fingerprint: string;
        message: string;
        count: number;
        lastSeen: Date;
    }>;
    errorsByType: Record<string, number>;
    errorsByEndpoint: Record<string, number>;
}

@Injectable()
export class ErrorTrackingService {
    private errors: Map<string, ErrorEvent> = new Map();
    private errorHistory: ErrorEvent[] = [];
    private readonly maxErrors = 10000;
    private readonly maxHistory = 1000;

    constructor(
        private readonly loggingService: LoggingService,
        private readonly metricsService: MetricsService,
        private readonly alertingService: AlertingService,
    ) {
        this.startErrorCleanup();
    }

    captureError(error: Error, context: any = {}): string {
        const fingerprint = this.generateFingerprint(error);
        const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const existingError = this.errors.get(fingerprint);
        const now = new Date();

        if (existingError) {
            // Update existing error
            existingError.count++;
            existingError.lastSeen = now;
            existingError.context = { ...existingError.context, ...context };
        } else {
            // Create new error
            const errorEvent: ErrorEvent = {
                id: errorId,
                timestamp: now,
                level: this.determineErrorLevel(error),
                message: error.message,
                stack: error.stack,
                context,
                fingerprint,
                count: 1,
                firstSeen: now,
                lastSeen: now,
            };

            this.errors.set(fingerprint, errorEvent);
            this.errorHistory.unshift(errorEvent);

            // Limit history size
            if (this.errorHistory.length > this.maxHistory) {
                this.errorHistory = this.errorHistory.slice(0, this.maxHistory);
            }
        }

        // Record metrics
        this.metricsService.incrementCounter('errors_total', {
            type: error.constructor.name,
            severity: this.determineErrorLevel(error),
        });

        // Log error
        this.loggingService.logError(`Error captured: ${error.message}`, {
            error,
            context,
        });

        // Check if alerting is needed
        this.checkForAlerting(fingerprint, error);

        return fingerprint;
    }

    captureException(
        message: string,
        level: 'error' | 'warning' | 'critical' = 'error',
        context: any = {}
    ): string {
        const error = new Error(message);
        error.name = 'CaptureException';

        return this.captureError(error, { ...context, level });
    }

    getErrorSummary(timeRange: number = 3600000): ErrorSummary {
        const since = new Date(Date.now() - timeRange);
        const recentErrors = this.errorHistory.filter(e => e.lastSeen >= since);

        // Calculate error rate (errors per hour)
        const errorRate = (recentErrors.length / (timeRange / 3600000));

        // Top errors by count
        const errorCounts = new Map<string, { message: string; count: number; lastSeen: Date }>();
        recentErrors.forEach(error => {
            const existing = errorCounts.get(error.fingerprint);
            if (existing) {
                existing.count += error.count;
                if (error.lastSeen > existing.lastSeen) {
                    existing.lastSeen = error.lastSeen;
                }
            } else {
                errorCounts.set(error.fingerprint, {
                    message: error.message,
                    count: error.count,
                    lastSeen: error.lastSeen,
                });
            }
        });

        const topErrors = Array.from(errorCounts.entries())
            .map(([fingerprint, data]) => ({ fingerprint, ...data }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        // Errors by type
        const errorsByType: Record<string, number> = {};
        recentErrors.forEach(error => {
            const type = error.stack?.split('\n')[0]?.split(':')[0] || 'Unknown';
            errorsByType[type] = (errorsByType[type] || 0) + error.count;
        });

        // Errors by endpoint
        const errorsByEndpoint: Record<string, number> = {};
        recentErrors.forEach(error => {
            const endpoint = error.context.endpoint || 'Unknown';
            errorsByEndpoint[endpoint] = (errorsByEndpoint[endpoint] || 0) + error.count;
        });

        return {
            totalErrors: recentErrors.reduce((sum, e) => sum + e.count, 0),
            errorRate,
            topErrors,
            errorsByType,
            errorsByEndpoint,
        };
    }

    getError(fingerprint: string): ErrorEvent | null {
        return this.errors.get(fingerprint) || null;
    }

    getRecentErrors(limit: number = 50): ErrorEvent[] {
        return this.errorHistory.slice(0, limit);
    }

    getErrorsByUser(userId: string, limit: number = 20): ErrorEvent[] {
        return this.errorHistory
            .filter(error => error.context.userId === userId)
            .slice(0, limit);
    }

    searchErrors(query: string, limit: number = 50): ErrorEvent[] {
        const lowerQuery = query.toLowerCase();
        return this.errorHistory
            .filter(error =>
                error.message.toLowerCase().includes(lowerQuery) ||
                error.stack?.toLowerCase().includes(lowerQuery) ||
                Object.values(error.context).some(value =>
                    typeof value === 'string' && value.toLowerCase().includes(lowerQuery)
                )
            )
            .slice(0, limit);
    }

    resolveError(fingerprint: string): boolean {
        const error = this.errors.get(fingerprint);
        if (error) {
            this.errors.delete(fingerprint);
            this.loggingService.logInfo(`Error resolved: ${fingerprint}`, {
                fingerprint,
                message: error.message,
            });
            return true;
        }
        return false;
    }

    private generateFingerprint(error: Error): string {
        // Create a unique fingerprint for grouping similar errors
        const message = error.message || 'Unknown error';
        const stack = error.stack?.split('\n')[1] || ''; // First line of stack trace

        const crypto = require('crypto');
        return crypto
            .createHash('md5')
            .update(`${error.name}:${message}:${stack}`)
            .digest('hex')
            .substring(0, 16);
    }

    private determineErrorLevel(error: Error): 'error' | 'warning' | 'critical' {
        const errorName = error.constructor.name.toLowerCase();
        const message = error.message.toLowerCase();

        // Critical errors
        if (
            errorName.includes('outofmemory') ||
            message.includes('database') ||
            message.includes('redis') ||
            message.includes('payment') ||
            message.includes('security')
        ) {
            return 'critical';
        }

        // Warnings
        if (
            errorName.includes('validation') ||
            errorName.includes('badrequest') ||
            message.includes('timeout') ||
            message.includes('rate limit')
        ) {
            return 'warning';
        }

        return 'error';
    }

    private checkForAlerting(fingerprint: string, error: Error) {
        const errorEvent = this.errors.get(fingerprint);
        if (!errorEvent) return;

        // Alert on critical errors immediately
        if (errorEvent.level === 'critical') {
            this.alertingService.sendAlert('critical_error', {
                message: error.message,
                fingerprint,
                count: errorEvent.count,
                stack: error.stack?.substring(0, 500),
            });
        }

        // Alert on high frequency errors
        const timeSinceFirst = Date.now() - errorEvent.firstSeen.getTime();
        const frequency = errorEvent.count / (timeSinceFirst / 60000); // errors per minute

        if (frequency > 10) { // More than 10 errors per minute
            this.alertingService.sendAlert('high_frequency_error', {
                message: error.message,
                fingerprint,
                count: errorEvent.count,
                frequency: frequency.toFixed(2),
            });
        }
    }

    private startErrorCleanup() {
        // Clean old errors every hour
        setInterval(() => {
            const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days

            let cleaned = 0;
            for (const [fingerprint, error] of this.errors.entries()) {
                if (error.lastSeen < cutoff) {
                    this.errors.delete(fingerprint);
                    cleaned++;
                }
            }

            // Clean history
            this.errorHistory = this.errorHistory.filter(e => e.lastSeen >= cutoff);

            if (cleaned > 0) {
                this.loggingService.logInfo(`Cleaned ${cleaned} old errors`);
            }
        }, 3600000);
    }
}