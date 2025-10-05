import { Logger } from '@nestjs/common';
import { LoggingService } from '../../modules/monitoring/services/logging.service';
import { CustomExceptionResponse } from '../exceptions/business.exception';

/**
 * Standardized error handling utility
 * Provides consistent error handling patterns across all services
 */
export class ErrorHandlerUtil {
  private static readonly logger = new Logger(ErrorHandlerUtil.name);

  /**
   * Handle and log errors with context
   * @param error - Error object
   * @param context - Additional context information
   * @param loggingService - Logging service instance
   * @param serviceName - Name of the service handling the error
   */
  static handleError(
    error: Error,
    context: any,
    loggingService: LoggingService,
    serviceName: string
  ): void {
    // Extract error details if it's a custom exception
    const errorDetails = this.extractErrorDetails(error);

    // Log error with structured context
    loggingService.logError(`Error in ${serviceName}`, error, {
      ...context,
      service: serviceName,
      errorName: error.constructor.name,
      errorMessage: error.message,
      stack: error.stack,
      ...errorDetails,
    });

    // Log to console for immediate visibility during development
    this.logger.error(`[${serviceName}] ${error.message}`, error.stack);
  }

  /**
   * Extract error details from custom exceptions
   * @param error - Error object
   * @private
   */
  private static extractErrorDetails(error: Error): any {
    try {
      // Check if it's a custom exception with response data
      if ('getResponse' in error && typeof error.getResponse === 'function') {
        const response = error.getResponse();
        if (typeof response === 'object' && response !== null) {
          return {
            errorCode: (response as CustomExceptionResponse).errorCode,
            errorDetails: (response as CustomExceptionResponse).details,
            errorTimestamp: (response as CustomExceptionResponse).timestamp,
          };
        }
      }
    } catch (e) {
      // Ignore extraction errors
    }

    return {};
  }

  /**
   * Handle async operation errors
   * @param operation - Async operation to execute
   * @param context - Context for error logging
   * @param loggingService - Logging service instance
   * @param serviceName - Name of the service
   * @param fallbackValue - Value to return if operation fails
   */
  static async handleAsyncOperation<T>(
    operation: () => Promise<T>,
    context: any,
    loggingService: LoggingService,
    serviceName: string,
    fallbackValue?: T
  ): Promise<T | undefined> {
    try {
      return await operation();
    } catch (error) {
      this.handleError(error as Error, context, loggingService, serviceName);
      return fallbackValue;
    }
  }

  /**
   * Handle sync operation errors
   * @param operation - Sync operation to execute
   * @param context - Context for error logging
   * @param loggingService - Logging service instance
   * @param serviceName - Name of the service
   * @param fallbackValue - Value to return if operation fails
   */
  static handleSyncOperation<T>(
    operation: () => T,
    context: any,
    loggingService: LoggingService,
    serviceName: string,
    fallbackValue?: T
  ): T | undefined {
    try {
      return operation();
    } catch (error) {
      this.handleError(error as Error, context, loggingService, serviceName);
      return fallbackValue;
    }
  }

  /**
   * Create error context object
   * @param userId - User ID (optional)
   * @param requestId - Request ID (optional)
   * @param additionalContext - Additional context data
   */
  static createErrorContext(
    userId?: string,
    requestId?: string,
    additionalContext?: Record<string, any>
  ): Record<string, any> {
    return {
      userId,
      requestId,
      timestamp: new Date().toISOString(),
      ...additionalContext,
    };
  }

  /**
   * Determine error severity based on error type
   * @param error - Error object
   */
  static determineErrorSeverity(error: Error): 'low' | 'medium' | 'high' | 'critical' {
    const errorName = error.constructor.name;

    // Critical errors
    if (errorName.includes('Database') || errorName.includes('Connection')) {
      return 'critical';
    }

    // High severity errors
    if (errorName.includes('Authentication') || errorName.includes('Authorization')) {
      return 'high';
    }

    // Medium severity errors
    if (errorName.includes('Validation') || errorName.includes('Business')) {
      return 'medium';
    }

    // Default to low severity
    return 'low';
  }

  /**
   * Format error message for user display
   * @param error - Error object
   * @param includeDetails - Whether to include technical details
   */
  static formatErrorMessage(error: Error, includeDetails: boolean = false): string {
    const baseMessage = error.message || 'An unexpected error occurred';

    if (!includeDetails) {
      return baseMessage;
    }

    return `${baseMessage} (${error.constructor.name})`;
  }
}
