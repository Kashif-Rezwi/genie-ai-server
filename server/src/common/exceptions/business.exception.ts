import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Business logic exception
 * Used for business rule violations and domain-specific errors
 */
export class BusinessException extends HttpException {
  constructor(message: string, errorCode: string, details?: any) {
    super(
      {
        message,
        errorCode,
        details,
        timestamp: new Date().toISOString(),
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

/**
 * Validation exception
 * Used for input validation errors
 */
export class ValidationException extends HttpException {
  constructor(message: string, errorCode: string, details?: any) {
    super(
      {
        message,
        errorCode,
        details,
        timestamp: new Date().toISOString(),
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

/**
 * Authentication exception
 * Used for authentication failures
 */
export class AuthenticationException extends HttpException {
  constructor(message: string, errorCode: string = 'AUTHENTICATION_FAILED') {
    super(
      {
        message,
        errorCode,
        timestamp: new Date().toISOString(),
      },
      HttpStatus.UNAUTHORIZED,
    );
  }
}

/**
 * Authorization exception
 * Used for authorization failures
 */
export class AuthorizationException extends HttpException {
  constructor(message: string, errorCode: string = 'AUTHORIZATION_FAILED') {
    super(
      {
        message,
        errorCode,
        timestamp: new Date().toISOString(),
      },
      HttpStatus.FORBIDDEN,
    );
  }
}

/**
 * Resource not found exception
 * Used when requested resource doesn't exist
 */
export class ResourceNotFoundException extends HttpException {
  constructor(resource: string, errorCode: string = 'RESOURCE_NOT_FOUND') {
    super(
      {
        message: `${resource} not found`,
        errorCode,
        timestamp: new Date().toISOString(),
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

/**
 * Conflict exception
 * Used when there's a conflict with current state
 */
export class ConflictException extends HttpException {
  constructor(message: string, errorCode: string = 'CONFLICT') {
    super(
      {
        message,
        errorCode,
        timestamp: new Date().toISOString(),
      },
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
      },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
