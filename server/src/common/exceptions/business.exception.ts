import { HttpException, HttpStatus } from '@nestjs/common';

export enum BusinessErrorCode {
    // Authentication errors
    INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
    ACCOUNT_DEACTIVATED = 'ACCOUNT_DEACTIVATED',
    EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED',
    TOKEN_EXPIRED = 'TOKEN_EXPIRED',
    TOKEN_INVALID = 'TOKEN_INVALID',

    // Authorization errors
    INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
    RESOURCE_ACCESS_DENIED = 'RESOURCE_ACCESS_DENIED',

    // Validation errors
    INVALID_INPUT = 'INVALID_INPUT',
    MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
    INVALID_FORMAT = 'INVALID_FORMAT',

    // Business logic errors
    INSUFFICIENT_CREDITS = 'INSUFFICIENT_CREDITS',
    CREDIT_RESERVATION_FAILED = 'CREDIT_RESERVATION_FAILED',
    PAYMENT_FAILED = 'PAYMENT_FAILED',
    PAYMENT_ALREADY_PROCESSED = 'PAYMENT_ALREADY_PROCESSED',

    // Resource errors
    USER_NOT_FOUND = 'USER_NOT_FOUND',
    CHAT_NOT_FOUND = 'CHAT_NOT_FOUND',
    MESSAGE_NOT_FOUND = 'MESSAGE_NOT_FOUND',
    PAYMENT_NOT_FOUND = 'PAYMENT_NOT_FOUND',

    // Rate limiting
    RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

    // External service errors
    AI_SERVICE_UNAVAILABLE = 'AI_SERVICE_UNAVAILABLE',
    PAYMENT_SERVICE_ERROR = 'PAYMENT_SERVICE_ERROR',
    EMAIL_SERVICE_ERROR = 'EMAIL_SERVICE_ERROR',

    // System errors
    DATABASE_ERROR = 'DATABASE_ERROR',
    CACHE_ERROR = 'CACHE_ERROR',
    CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
}

export class BusinessException extends HttpException {
    public readonly errorCode: BusinessErrorCode;
    public readonly details?: any;

    constructor(
        errorCode: BusinessErrorCode,
        message: string,
        status: HttpStatus = HttpStatus.BAD_REQUEST,
        details?: any,
    ) {
        const errorTitle = BusinessException.getErrorTitle(status);

        super(
            {
                error: errorTitle,
                message,
                code: errorCode,
                details,
            },
            status,
        );

        this.errorCode = errorCode;
        this.details = details;
    }

    private static getErrorTitle(status: HttpStatus): string {
        switch (status) {
            case HttpStatus.BAD_REQUEST:
                return 'Bad Request';
            case HttpStatus.UNAUTHORIZED:
                return 'Unauthorized';
            case HttpStatus.FORBIDDEN:
                return 'Forbidden';
            case HttpStatus.NOT_FOUND:
                return 'Not Found';
            case HttpStatus.CONFLICT:
                return 'Conflict';
            case HttpStatus.TOO_MANY_REQUESTS:
                return 'Too Many Requests';
            case HttpStatus.UNPROCESSABLE_ENTITY:
                return 'Validation Error';
            case HttpStatus.INTERNAL_SERVER_ERROR:
                return 'Internal Server Error';
            case HttpStatus.SERVICE_UNAVAILABLE:
                return 'Service Unavailable';
            default:
                return 'Error';
        }
    }

    // Static factory methods for common errors
    static invalidCredentials(message: string = 'Invalid email or password'): BusinessException {
        return new BusinessException(
            BusinessErrorCode.INVALID_CREDENTIALS,
            message,
            HttpStatus.UNAUTHORIZED,
        );
    }

    static accountDeactivated(
        message: string = 'Your account has been deactivated',
    ): BusinessException {
        return new BusinessException(
            BusinessErrorCode.ACCOUNT_DEACTIVATED,
            message,
            HttpStatus.UNAUTHORIZED,
        );
    }

    static emailNotVerified(
        message: string = 'Please verify your email address before proceeding',
    ): BusinessException {
        return new BusinessException(
            BusinessErrorCode.EMAIL_NOT_VERIFIED,
            message,
            HttpStatus.FORBIDDEN,
        );
    }

    static insufficientCredits(required: number, available: number): BusinessException {
        return new BusinessException(
            BusinessErrorCode.INSUFFICIENT_CREDITS,
            `Insufficient credits. Required: ${required}, Available: ${available}`,
            HttpStatus.BAD_REQUEST,
            { required, available },
        );
    }

    static userNotFound(userId: string): BusinessException {
        return new BusinessException(
            BusinessErrorCode.USER_NOT_FOUND,
            'User not found',
            HttpStatus.NOT_FOUND,
            { userId },
        );
    }

    static chatNotFound(chatId: string): BusinessException {
        return new BusinessException(
            BusinessErrorCode.CHAT_NOT_FOUND,
            'Chat not found',
            HttpStatus.NOT_FOUND,
            { chatId },
        );
    }

    static rateLimitExceeded(retryAfter?: number): BusinessException {
        return new BusinessException(
            BusinessErrorCode.RATE_LIMIT_EXCEEDED,
            'Rate limit exceeded. Please try again later',
            HttpStatus.TOO_MANY_REQUESTS,
            { retryAfter },
        );
    }

    static aiServiceUnavailable(service: string): BusinessException {
        return new BusinessException(
            BusinessErrorCode.AI_SERVICE_UNAVAILABLE,
            `AI service ${service} is temporarily unavailable`,
            HttpStatus.SERVICE_UNAVAILABLE,
            { service },
        );
    }

    static paymentFailed(reason: string): BusinessException {
        return new BusinessException(
            BusinessErrorCode.PAYMENT_FAILED,
            `Payment failed: ${reason}`,
            HttpStatus.BAD_REQUEST,
            { reason },
        );
    }

    static invalidInput(field: string, message: string): BusinessException {
        return new BusinessException(
            BusinessErrorCode.INVALID_INPUT,
            `Invalid ${field}: ${message}`,
            HttpStatus.BAD_REQUEST,
            { field, message },
        );
    }
}
