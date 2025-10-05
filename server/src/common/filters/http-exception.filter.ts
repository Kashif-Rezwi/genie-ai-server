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
import { CustomExceptionResponse } from '../exceptions/business.exception';

@Injectable()
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(
    private readonly loggingService: LoggingService,
    private readonly errorService: ErrorService
  ) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const request = context.getRequest();
    const response = context.getResponse();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException ? exception.getResponse() : 'Internal server error';

    // Extract error details for custom exceptions
    let errorResponse: CustomExceptionResponse | any = message;
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === 'object' && response !== null && 'errorCode' in response) {
        errorResponse = response as CustomExceptionResponse;
        // Add request ID to custom exception response
        errorResponse.requestId = (request as any).requestId;
      }
    }

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
      errorCode: errorResponse?.errorCode,
      errorDetails: errorResponse?.details,
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
        errorContext
      );
    }

    // Return standardized error response
    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId: (request as any).requestId,
      ...errorResponse,
    });
  }
}
