import { Injectable, CanActivate, ExecutionContext, BadRequestException, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { CSRFProtectionService } from '../services/csrf-protection.service';
import { SecurityService } from '../services/security.service';

export const CSRF_SKIP_KEY = 'csrf_skip';
export const SkipCSRF = () => SetMetadata(CSRF_SKIP_KEY, true);

@Injectable()
export class CSRFProtectionGuard implements CanActivate {
    constructor(
        private readonly csrfService: CSRFProtectionService,
        private readonly securityService: SecurityService,
        private readonly reflector: Reflector,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<Request>();
        
        // Skip CSRF protection for certain endpoints
        const skipCSRF = this.reflector.getAllAndOverride<boolean>(CSRF_SKIP_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        if (skipCSRF) {
            return true;
        }

        // Skip CSRF protection for GET, HEAD, OPTIONS requests
        if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
            return true;
        }

        // Skip CSRF protection for public endpoints
        if (this.isPublicEndpoint(request.path)) {
            return true;
        }

        // Extract CSRF token from request
        const csrfToken = this.extractCSRFToken(request);
        
        if (!csrfToken) {
            throw new BadRequestException('CSRF token is required');
        }

        // Extract user and session information
        const userId = (request.user as any)?.id;
        const sessionId = this.extractSessionId(request);

        // Validate CSRF token
        const validation = await this.csrfService.validateToken(csrfToken, userId, sessionId || undefined);

        if (!validation.isValid) {
            throw new BadRequestException(`CSRF validation failed: ${validation.reason}`);
        }

        // Log security event
        await this.securityService.logSecurityEvent({
            userId,
            event: 'csrf_token_validated',
            details: {
                endpoint: request.path,
                method: request.method,
                userAgent: this.securityService.extractUserAgentFromRequest(request),
            },
            ip: this.securityService.extractIPFromRequest(request),
            userAgent: this.securityService.extractUserAgentFromRequest(request),
            timestamp: new Date(),
        });

        return true;
    }

    private extractCSRFToken(request: Request): string | null {
        // Try to get token from header first
        const headerToken = request.headers['x-csrf-token'] || request.headers['x-xsrf-token'];
        if (headerToken && typeof headerToken === 'string') {
            return headerToken;
        }

        // Try to get token from body
        if (request.body && typeof request.body === 'object') {
            const bodyToken = request.body._csrf || request.body.csrfToken;
            if (bodyToken && typeof bodyToken === 'string') {
                return bodyToken;
            }
        }

        // Try to get token from query parameters
        const queryToken = request.query._csrf || request.query.csrfToken;
        if (queryToken && typeof queryToken === 'string') {
            return queryToken;
        }

        return null;
    }

    private extractSessionId(request: Request): string | null {
        // Try to get session ID from various sources
        const sessionId = 
            request.headers['x-session-id'] ||
            request.cookies?.sessionId ||
            (request as any).session?.id;

        return typeof sessionId === 'string' ? sessionId : null;
    }

    private isPublicEndpoint(path: string): boolean {
        const publicEndpoints = [
            '/api/auth/login',
            '/api/auth/register',
            '/api/auth/forgot-password',
            '/api/auth/reset-password',
            '/api/health',
            '/api/monitoring/health',
            '/api/payments/webhook', // Webhooks don't need CSRF protection
        ];

        return publicEndpoints.some(endpoint => path.startsWith(endpoint));
    }
}
