import { Request } from 'express';

/**
 * Shared utility for extracting client IP from request
 * Eliminates duplication across LoggingService and AllExceptionsFilter
 */
export function getClientIP(req: Request): string {
  return (
    req.ip ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    (req as any).headers?.['x-forwarded-for']?.split(',')[0] ||
    'unknown'
  );
}

/**
 * Sanitize request body by removing sensitive fields
 * Used for error logging and security
 */
export function sanitizeBody(body: any): any {
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
