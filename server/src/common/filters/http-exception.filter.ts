import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { LoggingService } from '../../modules/monitoring/services/logging.service';
import { ErrorService } from '../../modules/monitoring/services/error.service';
import { getClientIP } from '../utils/request.utils';

@Injectable()
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
    constructor(
        private readonly loggingService: LoggingService,
        private readonly errorService: ErrorService,
    ) {}

    catch(exception: unknown, host: ArgumentsHost) {
        const context = host.switchToHttp();
        const request = context.getRequest();
        const response = context.getResponse();

        const status =
            exception instanceof HttpException
                ? exception.getStatus()
                : HttpStatus.INTERNAL_SERVER_ERROR;

        const message = this.sanitizeErrorMessage(
            exception instanceof HttpException ? exception.getResponse() : 'Internal server error'
        );

        // Create error context for logging
        const errorContext = {
            requestId: (request as any).requestId,
            userId: (request as any).user?.id,
            method: request.method,
            url: request.url,
            userAgent: request.get('User-Agent'),
            ip: getClientIP(request),
            statusCode: status,
            timestamp: new Date().toISOString(),
        };

        // Log the error with context
        if (exception instanceof Error) {
            this.loggingService.logError(
                `HTTP Exception: ${message}`,
                exception,
                errorContext
            );
            
            // Capture critical errors for alerting
            if (status >= 500) {
                this.errorService.captureError(exception, errorContext);
            }
        } else {
            this.loggingService.logError(
                `Unknown Exception: ${message}`,
                new Error(String(exception)),
                errorContext
            );
        }

        response.status(status).json({
            statusCode: status,
            timestamp: new Date().toISOString(),
            path: request.url,
            message,
            requestId: (request as any).requestId,
        });
    }

    private sanitizeErrorMessage(message: any): string {
        if (typeof message === 'string') {
            // Remove sensitive information patterns
            return message
                .replace(/password[^,}]*/gi, 'password: [REDACTED]')
                .replace(/token[^,}]*/gi, 'token: [REDACTED]')
                .replace(/key[^,}]*/gi, 'key: [REDACTED]')
                .replace(/secret[^,}]*/gi, 'secret: [REDACTED]')
                .replace(/authorization[^,}]*/gi, 'authorization: [REDACTED]')
                .replace(/api[_-]?key[^,}]*/gi, 'api_key: [REDACTED]');
        }
        
        if (typeof message === 'object' && message !== null) {
            // Recursively sanitize object properties
            const sanitized = { ...message };
            for (const key in sanitized) {
                if (typeof sanitized[key] === 'string') {
                    sanitized[key] = this.sanitizeErrorMessage(sanitized[key]);
                }
            }
            return sanitized;
        }
        
        return 'Internal server error';
    }

}
