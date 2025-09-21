import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ErrorTrackingService } from '../services/error-tracking.service';
import { LoggingService } from '../services/logging.service';

@Injectable()
export class ErrorMonitoringMiddleware implements NestMiddleware {
    constructor(
        private readonly errorTrackingService: ErrorTrackingService,
        private readonly loggingService: LoggingService,
    ) { }

    use(req: Request, res: Response, next: NextFunction) {
        // Wrap the next function to catch any errors
        const wrappedNext = (error?: any) => {
            if (error) {
                // Capture error with context
                const context = {
                    requestId: (req as any).requestId,
                    userId: (req as any).user?.id,
                    endpoint: `${req.method} ${req.url}`,
                    userAgent: req.get('User-Agent'),
                    ip: this.getClientIP(req),
                    body: req.method === 'POST' ? this.sanitizeBody(req.body) : undefined,
                    query: Object.keys(req.query).length > 0 ? req.query : undefined,
                };

                // Track the error
                this.errorTrackingService.captureError(error, context);

                // Log the error
                this.loggingService.logError('Unhandled request error', {
                    error,
                    context,
                });
            }

            next(error);
        };

        next = wrappedNext;
        next();
    }

    private getClientIP(req: Request): string {
        return (
            req.ip ||
            req.connection?.remoteAddress ||
            req.socket?.remoteAddress ||
            (req as any).headers?.['x-forwarded-for']?.split(',')[0] ||
            'unknown'
        );
    }

    private sanitizeBody(body: any): any {
        if (!body || typeof body !== 'object') return body;

        // Remove sensitive fields
        const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth'];
        const sanitized = { ...body };

        for (const field of sensitiveFields) {
            if (field in sanitized) {
                sanitized[field] = '[REDACTED]';
            }
        }

        return sanitized;
    }
}