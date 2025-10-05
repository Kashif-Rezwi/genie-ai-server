import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Base interface for all custom exceptions
 */
export interface CustomExceptionResponse {
  message: string;
  errorCode: string;
  details?: any;
  timestamp: string;
  requestId?: string;
}

/**
 * Business logic exception
 * Used for business rule violations and domain-specific errors
 */
export class BusinessException extends HttpException {
  constructor(message: string, errorCode: string = 'BUSINESS_RULE_VIOLATION', details?: any) {
    super(
      {
        message,
        errorCode,
        details,
        timestamp: new Date().toISOString(),
      } as CustomExceptionResponse,
      HttpStatus.BAD_REQUEST,
    );
  }
}

/**
 * Validation exception
 * Used for input validation errors
 */
export class ValidationException extends HttpException {
  constructor(message: string, errorCode: string = 'VALIDATION_FAILED', details?: any) {
    super(
      {
        message,
        errorCode,
        details,
        timestamp: new Date().toISOString(),
      } as CustomExceptionResponse,
      HttpStatus.BAD_REQUEST,
    );
  }
}

/**
 * Authentication exception
 * Used for authentication failures
 */
export class AuthenticationException extends HttpException {
  constructor(message: string, errorCode: string = 'AUTHENTICATION_FAILED', details?: any) {
    super(
      {
        message,
        errorCode,
        details,
        timestamp: new Date().toISOString(),
      } as CustomExceptionResponse,
      HttpStatus.UNAUTHORIZED,
    );
  }
}

/**
 * Authorization exception
 * Used for authorization failures
 */
export class AuthorizationException extends HttpException {
  constructor(message: string, errorCode: string = 'AUTHORIZATION_FAILED', details?: any) {
    super(
      {
        message,
        errorCode,
        details,
        timestamp: new Date().toISOString(),
      } as CustomExceptionResponse,
      HttpStatus.FORBIDDEN,
    );
  }
}

/**
 * Resource not found exception
 * Used when requested resource doesn't exist
 */
export class ResourceNotFoundException extends HttpException {
  constructor(resource: string, errorCode: string = 'RESOURCE_NOT_FOUND', details?: any) {
    super(
      {
        message: `${resource} not found`,
        errorCode,
        details,
        timestamp: new Date().toISOString(),
      } as CustomExceptionResponse,
      HttpStatus.NOT_FOUND,
    );
  }
}

/**
 * Conflict exception
 * Used when there's a conflict with current state
 */
export class ConflictException extends HttpException {
  constructor(message: string, errorCode: string = 'CONFLICT', details?: any) {
    super(
      {
        message,
        errorCode,
        details,
        timestamp: new Date().toISOString(),
      } as CustomExceptionResponse,
      HttpStatus.CONFLICT,
    );
  }
}

/**
 * Internal server exception
 * Used for unexpected server errors
 */
export class InternalServerException extends HttpException {
  constructor(message: string, errorCode: string = 'INTERNAL_SERVER_ERROR', details?: any) {
    super(
      {
        message,
        errorCode,
        details,
        timestamp: new Date().toISOString(),
      } as CustomExceptionResponse,
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}

/**
 * Rate limit exception
 * Used when rate limits are exceeded
 */
export class RateLimitException extends HttpException {
  constructor(message: string, errorCode: string = 'RATE_LIMIT_EXCEEDED', details?: any) {
    super(
      {
        message,
        errorCode,
        details,
        timestamp: new Date().toISOString(),
      } as CustomExceptionResponse,
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

/**
 * Payment exception
 * Used for payment-related errors
 */
export class PaymentException extends HttpException {
  constructor(message: string, errorCode: string = 'PAYMENT_ERROR', details?: any) {
    super(
      {
        message,
        errorCode,
        details,
        timestamp: new Date().toISOString(),
      } as CustomExceptionResponse,
      HttpStatus.BAD_REQUEST,
    );
  }
}

/**
 * Credit exception
 * Used for credit-related errors
 */
export class CreditException extends HttpException {
  constructor(message: string, errorCode: string = 'CREDIT_ERROR', details?: any) {
    super(
      {
        message,
        errorCode,
        details,
        timestamp: new Date().toISOString(),
      } as CustomExceptionResponse,
      HttpStatus.BAD_REQUEST,
    );
  }
}
