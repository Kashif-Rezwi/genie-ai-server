import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PerUserRateLimitService } from '../services/per-user-rate-limit.service';
import { BruteForceProtectionService } from '../services/brute-force-protection.service';
import { AuditLoggingService } from '../services/audit-logging.service';
import { ContentSecurityPolicyService } from '../services/content-security-policy.service';

@Injectable()
export class SecurityMiddleware implements NestMiddleware {
  private readonly logger = new Logger(SecurityMiddleware.name);

  constructor(
    private readonly rateLimitService: PerUserRateLimitService,
    private readonly bruteForceService: BruteForceProtectionService,
    private readonly auditService: AuditLoggingService,
    private readonly cspService: ContentSecurityPolicyService
  ) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Set security headers
      this.setSecurityHeaders(req, res);

      // Extract user information
      const userId = this.extractUserId(req);
      const userTier = userId ? await this.rateLimitService.getUserTier(userId) : 'free';
      const ipAddress = this.extractIpAddress(req);
      const userAgent = req.get('User-Agent') || 'unknown';

      // Check brute force protection for sensitive endpoints
      if (this.isSensitiveEndpoint(req.path, req.method)) {
        const bruteForceResult = await this.bruteForceService.checkBruteForce(
          userId || ipAddress,
          this.getActionType(req.path)
        );

        if (!bruteForceResult.allowed) {
          await this.logSecurityEvent(req, res, {
            action: 'security:brute_force_blocked',
            resource: 'authentication',
            severity: 'high',
            outcome: 'failure',
            details: {
              reason: 'Brute force protection triggered',
              attemptsRemaining: bruteForceResult.attemptsRemaining,
              blockExpiresAt: bruteForceResult.blockExpiresAt,
            },
          });

          res.status(429).json({
            success: false,
            message: 'Too many attempts. Please try again later.',
            error: 'RATE_LIMIT_EXCEEDED',
            retryAfter: bruteForceResult.nextAttemptDelay,
          });
          return;
        }
      }

      // Check per-user rate limiting
      if (userId) {
        const endpoint = this.normalizeEndpoint(req.path, req.method);
        const rateLimitResult = await this.rateLimitService.checkRateLimit(
          userId,
          endpoint,
          userTier
        );

        if (!rateLimitResult.allowed) {
          await this.logSecurityEvent(req, res, {
            action: 'security:rate_limit_exceeded',
            resource: endpoint,
            severity: 'medium',
            outcome: 'failure',
            details: {
              limit: rateLimitResult.limit,
              remaining: rateLimitResult.remaining,
              resetTime: rateLimitResult.resetTime,
            },
          });

          res.set({
            'X-RateLimit-Limit': rateLimitResult.limit.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': new Date(rateLimitResult.resetTime).toISOString(),
            'Retry-After': rateLimitResult.retryAfter?.toString() || '60',
          });

          res.status(429).json({
            success: false,
            message: 'Rate limit exceeded. Please try again later.',
            error: 'RATE_LIMIT_EXCEEDED',
            retryAfter: rateLimitResult.retryAfter,
          });
          return;
        }

        // Set rate limit headers
        res.set({
          'X-RateLimit-Limit': rateLimitResult.limit.toString(),
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': new Date(rateLimitResult.resetTime).toISOString(),
        });
      }

      // Log successful request
      await this.logSecurityEvent(req, res, {
        action: this.getActionFromPath(req.path, req.method),
        resource: this.normalizeEndpoint(req.path, req.method),
        severity: 'low',
        outcome: 'success',
        details: {
          method: req.method,
          path: req.path,
          query: req.query,
          hasApiKey: false,
        },
      });

      next();
    } catch (error) {
      this.logger.error('Security middleware error:', error);

      // Log security error
      await this.logSecurityEvent(req, res, {
        action: 'security:middleware_error',
        resource: 'middleware',
        severity: 'high',
        outcome: 'error',
        details: {
          error: error.message,
          stack: error.stack,
        },
      });

      res.status(500).json({
        success: false,
        message: 'Internal security error',
        error: 'SECURITY_ERROR',
      });
    }
  }

  /**
   * Set security headers
   * @param req - Request object
   * @param res - Response object
   * @returns void
   */
  private setSecurityHeaders(req: Request, res: Response): void {
    try {
      // Content Security Policy
      const cspHeader = this.cspService.getCSPHeader(process.env.NODE_ENV || 'production', {
        reportUri: '/api/security/csp-report',
      });
      res.set('Content-Security-Policy', cspHeader);

      // Additional security headers
      res.set({
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'X-Permitted-Cross-Domain-Policies': 'none',
        'Cross-Origin-Embedder-Policy': 'require-corp',
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Resource-Policy': 'same-origin',
      });
    } catch (error) {
      this.logger.error('Set security headers error:', error);
    }
  }

  /**
   * Extract user ID from request
   * @param req - Request object
   * @returns string | undefined - User ID
   */
  private extractUserId(req: Request): string | undefined {
    // Try JWT token first
    const authHeader = req.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        // In a real implementation, you would decode the JWT here
        // For now, we'll extract from the request object if available
        return (req as any).user?.id;
      } catch (error) {
        this.logger.warn('JWT extraction error:', error);
      }
    }

    // Try session
    if ((req as any).session?.userId) {
      return (req as any).session.userId;
    }

    return undefined;
  }

  /**
   * Extract IP address from request
   * @param req - Request object
   * @returns string - IP address
   */
  private extractIpAddress(req: Request): string {
    return (
      req.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
      req.get('X-Real-IP') ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      'unknown'
    );
  }

  /**
   * Check if endpoint is sensitive
   * @param path - Request path
   * @param method - HTTP method
   * @returns boolean - Whether endpoint is sensitive
   */
  private isSensitiveEndpoint(path: string, method: string): boolean {
    const sensitivePaths = [
      '/auth/login',
      '/auth/register',
      '/auth/password-reset',
      '/auth/change-password',
      '/api-keys',
      '/admin',
    ];

    return sensitivePaths.some(sensitivePath => path.startsWith(sensitivePath));
  }

  /**
   * Get action type from path
   * @param path - Request path
   * @returns string - Action type
   */
  private getActionType(path: string): string {
    if (path.includes('/auth/login')) return 'login';
    if (path.includes('/auth/register')) return 'register';
    if (path.includes('/auth/password-reset')) return 'password_reset';
    if (path.includes('/api-keys')) return 'api_key';
    return 'login';
  }

  /**
   * Get action from path and method
   * @param path - Request path
   * @param method - HTTP method
   * @returns string - Action name
   */
  private getActionFromPath(path: string, method: string): string {
    const methodPrefix = method.toLowerCase();

    if (path.includes('/auth/login')) return 'user:login';
    if (path.includes('/auth/logout')) return 'user:logout';
    if (path.includes('/auth/register')) return 'user:register';
    if (path.includes('/auth/password-reset')) return 'user:password_reset';
    if (path.includes('/auth/change-password')) return 'user:password_change';
    if (path.includes('/api-keys')) {
      if (methodPrefix === 'post') return 'api_key:create';
      if (methodPrefix === 'put' || methodPrefix === 'patch') return 'api_key:update';
      if (methodPrefix === 'delete') return 'api_key:delete';
      return 'api_key:read';
    }
    if (path.includes('/credits')) {
      if (methodPrefix === 'post') return 'credits:purchase';
      if (methodPrefix === 'put') return 'credits:transfer';
      return 'credits:read';
    }
    if (path.includes('/payments')) {
      if (methodPrefix === 'post') return 'payment:process';
      if (methodPrefix === 'put') return 'payment:refund';
      return 'payment:read';
    }
    if (path.includes('/admin')) return 'admin:system_config';

    return `${methodPrefix}:${path.replace(/^\//, '').replace(/\//g, ':')}`;
  }

  /**
   * Normalize endpoint for rate limiting
   * @param path - Request path
   * @param method - HTTP method
   * @returns string - Normalized endpoint
   */
  private normalizeEndpoint(path: string, method: string): string {
    // Remove query parameters
    const cleanPath = path.split('?')[0];

    // Normalize path parameters
    const normalizedPath = cleanPath
      .replace(/\/\d+/g, '/:id')
      .replace(/\/[a-f0-9-]{36}/g, '/:uuid')
      .replace(/\/[a-f0-9-]{8}-[a-f0-9-]{4}-[a-f0-9-]{4}-[a-f0-9-]{4}-[a-f0-9-]{12}/g, '/:uuid');

    return `${method.toLowerCase()}:${normalizedPath}`;
  }

  /**
   * Log security event
   * @param req - Request object
   * @param res - Response object
   * @param eventData - Event data
   * @returns Promise<void>
   */
  private async logSecurityEvent(
    req: Request,
    res: Response,
    eventData: Partial<any>
  ): Promise<void> {
    try {
      await this.auditService.logEvent({
        userId: this.extractUserId(req),
        sessionId: (req as any).sessionID,
        ipAddress: this.extractIpAddress(req),
        userAgent: req.get('User-Agent') || 'unknown',
        ...eventData,
      });
    } catch (error) {
      this.logger.error('Log security event error:', error);
    }
  }
}
