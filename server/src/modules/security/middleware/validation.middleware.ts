import { Injectable, NestMiddleware, BadRequestException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { securityConfig } from '../../../config';
import { InputSanitizationService } from '../services/input-sanitization.service';
import { RequestSizeService } from '../services/request-size.service';

@Injectable()
export class ValidationMiddleware implements NestMiddleware {
  private readonly config = securityConfig();

  constructor(
    private readonly sanitizationService: InputSanitizationService,
    private readonly requestSizeService: RequestSizeService
  ) {}

  use(req: Request, res: Response, next: NextFunction) {
    // Check request size using RequestSizeService
    try {
      this.requestSizeService.validateRequestSize(req);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      // If RequestSizeService fails, fall back to basic size check
      const maxSize = this.config.request.maxSize;
      if (req.headers['content-length'] && parseInt(req.headers['content-length']) > maxSize) {
        throw new BadRequestException('Request entity too large');
      }
    }

    // Validate Content-Type for POST/PUT requests
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      const contentType = req.headers['content-type'];

      if (contentType && !this.isAllowedContentType(contentType)) {
        throw new BadRequestException('Invalid content type');
      }
    }

    // Rate limit by IP for specific endpoints
    if (this.isHighRiskEndpoint(req.path)) {
      this.checkHighRiskRequest(req);
    }

    // Sanitize request body
    if (req.body && typeof req.body === 'object') {
      req.body = this.sanitizeRequestBody(req.body);
    }

    // Sanitize query parameters
    if (req.query && typeof req.query === 'object') {
      req.query = this.sanitizeQueryParameters(req.query);
    }

    next();
  }

  private isAllowedContentType(contentType: string): boolean {
    const allowedTypes = [
      'application/json',
      'application/x-www-form-urlencoded',
      'multipart/form-data',
      'text/plain',
    ];

    return allowedTypes.some(type => contentType.startsWith(type));
  }

  private isHighRiskEndpoint(path: string): boolean {
    const highRiskPaths = [
      '/api/auth/login',
      '/api/auth/register',
      '/api/payments/webhook',
      '/api/auth/reset-password',
    ];

    return highRiskPaths.some(riskPath => path.startsWith(riskPath));
  }

  private checkHighRiskRequest(req: Request) {
    // Additional validation for high-risk endpoints
    const userAgent = req.headers['user-agent'];

    if (!userAgent || userAgent.length < 10) {
      throw new BadRequestException('Invalid user agent');
    }

    // Check for bot-like behavior
    const botPatterns = [/bot|crawler|spider|scraper/i, /curl|wget|httpie/i];

    const isBot = botPatterns.some(pattern => pattern.test(userAgent));

    if (isBot && req.path.includes('/auth/')) {
      throw new BadRequestException('Automated requests not allowed for authentication');
    }
  }

  private sanitizeRequestBody(body: any): any {
    if (typeof body === 'string') {
      const result = this.sanitizationService.sanitizeText(body);
      return result.sanitizedValue;
    }

    if (Array.isArray(body)) {
      return body.map(item => this.sanitizeRequestBody(item));
    }

    if (body && typeof body === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(body)) {
        const sanitizedKey = this.sanitizationService.sanitizeText(key, {
          maxLength: 100,
        }).sanitizedValue;
        sanitized[sanitizedKey] = this.sanitizeRequestBody(value);
      }
      return sanitized;
    }

    return body;
  }

  private sanitizeQueryParameters(query: any): any {
    if (typeof query === 'string') {
      const result = this.sanitizationService.sanitizeText(query, { maxLength: 500 });
      return result.sanitizedValue;
    }

    if (Array.isArray(query)) {
      return query.map(item => this.sanitizeQueryParameters(item));
    }

    if (query && typeof query === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(query)) {
        const sanitizedKey = this.sanitizationService.sanitizeText(key, {
          maxLength: 100,
        }).sanitizedValue;
        sanitized[sanitizedKey] = this.sanitizeQueryParameters(value);
      }
      return sanitized;
    }

    return query;
  }
}
