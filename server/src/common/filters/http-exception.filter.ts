import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
    Injectable,
} from '@nestjs/common';
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
            exception instanceof HttpException ? exception.getResponse() : 'Internal server error',
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
            this.loggingService.logError(`HTTP Exception: ${message}`, exception, errorContext);

            // Capture critical errors for alerting
            if (status >= 500) {
                this.errorService.captureError(exception, errorContext);
            }
        } else {
            this.loggingService.logError(
                `Unknown Exception: ${message}`,
                new Error(String(exception)),
                errorContext,
            );
        }

        // Generate user-friendly error response
        const errorResponse = this.generateUserFriendlyError(status, message, request);

        response.status(status).json(errorResponse);
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

    private generateUserFriendlyError(status: number, message: any, request: any): any {
        const baseResponse = {
            statusCode: status,
            timestamp: new Date().toISOString(),
            path: request.url,
            requestId: (request as any).requestId,
        };

        // Handle different error types with user-friendly messages
        switch (status) {
            case HttpStatus.BAD_REQUEST:
                return {
                    ...baseResponse,
                    error: 'Bad Request',
                    message: this.getBadRequestMessage(message),
                    code: 'VALIDATION_ERROR',
                };

            case HttpStatus.UNAUTHORIZED:
                return {
                    ...baseResponse,
                    error: 'Unauthorized',
                    message: 'Please log in to access this resource',
                    code: 'AUTHENTICATION_REQUIRED',
                };

            case HttpStatus.FORBIDDEN:
                return {
                    ...baseResponse,
                    error: 'Forbidden',
                    message: 'You do not have permission to access this resource',
                    code: 'ACCESS_DENIED',
                };

            case HttpStatus.NOT_FOUND:
                return {
                    ...baseResponse,
                    error: 'Not Found',
                    message: 'The requested resource was not found',
                    code: 'RESOURCE_NOT_FOUND',
                };

            case HttpStatus.CONFLICT:
                return {
                    ...baseResponse,
                    error: 'Conflict',
                    message: this.getConflictMessage(message),
                    code: 'RESOURCE_CONFLICT',
                };

            case HttpStatus.TOO_MANY_REQUESTS:
                return {
                    ...baseResponse,
                    error: 'Too Many Requests',
                    message: 'Rate limit exceeded. Please try again later',
                    code: 'RATE_LIMIT_EXCEEDED',
                };

            case HttpStatus.UNPROCESSABLE_ENTITY:
                return {
                    ...baseResponse,
                    error: 'Validation Error',
                    message: this.getValidationMessage(message),
                    code: 'VALIDATION_FAILED',
                };

            case HttpStatus.INTERNAL_SERVER_ERROR:
                return {
                    ...baseResponse,
                    error: 'Internal Server Error',
                    message: 'Something went wrong. Please try again later',
                    code: 'INTERNAL_ERROR',
                };

            case HttpStatus.SERVICE_UNAVAILABLE:
                return {
                    ...baseResponse,
                    error: 'Service Unavailable',
                    message: 'The service is temporarily unavailable. Please try again later',
                    code: 'SERVICE_UNAVAILABLE',
                };

            default:
                return {
                    ...baseResponse,
                    error: 'Error',
                    message: typeof message === 'string' ? message : 'An error occurred',
                    code: 'UNKNOWN_ERROR',
                };
        }
    }

    private getBadRequestMessage(message: any): string {
        if (typeof message === 'string') {
            if (message.includes('validation')) {
                return 'Please check your input and try again';
            }
            if (message.includes('invalid')) {
                return 'The provided information is invalid';
            }
            return message;
        }
        return 'Invalid request. Please check your input';
    }

    private getConflictMessage(message: any): string {
        if (typeof message === 'string') {
            if (message.includes('already exists')) {
                return 'This resource already exists';
            }
            if (message.includes('duplicate')) {
                return 'A duplicate entry was found';
            }
            return message;
        }
        return 'A conflict occurred with your request';
    }

    private getValidationMessage(message: any): string {
        if (typeof message === 'object' && message.message) {
            return Array.isArray(message.message) ? message.message.join(', ') : message.message;
        }
        if (typeof message === 'string') {
            return message;
        }
        return 'Validation failed. Please check your input';
    }
}
