import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { SecurityService } from '../services/security.service';
import { InputSanitizationService } from '../services/input-sanitization.service';
import { appConfig } from '../../../config';

@Injectable()
export class SecurityMiddleware implements NestMiddleware {
  private readonly config = appConfig();

  constructor(
    private readonly securityService: SecurityService,
    private readonly sanitizationService: InputSanitizationService
  ) {}

  use(req: Request, res: Response, next: NextFunction) {
    // Add security headers
    this.addSecurityHeaders(res);

    // Sanitize query parameters
    this.sanitizeQueryParams(req);

    // Log request for security monitoring
    this.logRequest(req);

    next();
  }

  private addSecurityHeaders(res: Response) {
    // Prevent XSS attacks
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // Prevent information disclosure
    res.removeHeader('X-Powered-By');

    // HSTS (only in production with HTTPS)
    if (this.config.nodeEnv === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }

    // Content Security Policy (more restrictive)
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none';"
    );

    // Referrer Policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Additional security headers
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    res.setHeader('X-Download-Options', 'noopen');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  }

  private sanitizeQueryParams(req: Request) {
    if (req.query) {
      for (const [key, value] of Object.entries(req.query)) {
        if (typeof value === 'string') {
          req.query[key] = this.sanitizationService.sanitizeText(value).sanitizedValue;
        }
      }
    }
  }

  private logRequest(req: Request) {
    // Log potentially suspicious requests
    const suspiciousPatterns = [
      /script|alert|onerror|onload/i,
      /union|select|insert|delete|drop/i,
      /\.\.\/|\.\.\\|%2e%2e/i,
    ];

    const url = req.url.toLowerCase();
    const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(url));

    if (isSuspicious) {
      this.securityService.logSecurityEvent({
        event: 'suspicious_request',
        details: {
          url: req.url,
          method: req.method,
          query: req.query,
          body: req.method === 'POST' ? req.body : undefined,
        },
        ip: this.securityService.extractIPFromRequest(req),
        userAgent: this.securityService.extractUserAgentFromRequest(req),
        timestamp: new Date(),
      });
    }
  }
}
