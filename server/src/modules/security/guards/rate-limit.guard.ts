import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SetMetadata } from '@nestjs/common';
import { RateLimitService } from '../services/rate-limit.service';
import { SecurityService } from '../services/security.service';
import { BusinessException } from '../../../common/exceptions/business.exception';

export const RATE_LIMIT_KEY = 'rateLimit';
export const RateLimit = (operation: string, customLimit?: number) =>
    SetMetadata(RATE_LIMIT_KEY, { operation, customLimit });

@Injectable()
export class RateLimitGuard implements CanActivate {
    private readonly logger = new Logger(RateLimitGuard.name);

    constructor(
        private readonly rateLimitService: RateLimitService,
        private readonly securityService: SecurityService,
        private readonly reflector: Reflector,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const rateLimitConfig = this.reflector.getAllAndOverride<{
            operation: string;
            customLimit?: number;
        }>(RATE_LIMIT_KEY, [context.getHandler(), context.getClass()]);

        // If no specific rate limit config, apply default global rate limiting
        const operation = rateLimitConfig?.operation || 'api';

        const request = context.switchToHttp().getRequest();
        const response = context.switchToHttp().getResponse();
        const user = request.user;
        const ip = this.securityService.extractIPFromRequest(request);

        try {
            let result;
            const identifier = user ? `user:${user.id}` : `ip:${ip}`;

            // Check user-specific rate limit if authenticated
            if (user) {
                result = await this.rateLimitService.checkUserRateLimit(user.id, operation);
            } else {
                // Check IP-based rate limit for unauthenticated users
                result = await this.rateLimitService.checkRateLimit('global', ip);
            }

            // Add comprehensive rate limit headers
            this.setRateLimitHeaders(response, result);

            // Log successful rate limit check
            this.logger.debug(`Rate limit check passed for ${identifier}`, {
                operation,
                consumedPoints: result.consumedPoints,
                remainingPoints: result.remainingPoints,
                msBeforeNext: result.msBeforeNext,
            });

            // Log security event
            await this.securityService.logSecurityEvent({
                userId: user?.id,
                event: 'rate_limit_check',
                details: {
                    operation: operation,
                    endpoint: request.url,
                    method: request.method,
                    consumedPoints: result.consumedPoints,
                    remainingPoints: result.remainingPoints,
                },
                ip,
                userAgent: this.securityService.extractUserAgentFromRequest(request),
                timestamp: new Date(),
            });

            return true;
        } catch (error) {
            // Log rate limit exceeded with enhanced details
            this.logger.warn(`Rate limit exceeded for ${user ? `user:${user.id}` : `ip:${ip}`}`, {
                operation,
                endpoint: request.url,
                method: request.method,
                error: error.message,
            });

            await this.securityService.logSecurityEvent({
                userId: user?.id,
                event: 'rate_limit_exceeded',
                details: {
                    operation: operation,
                    endpoint: request.url,
                    method: request.method,
                    error: error.message,
                    identifier: user ? `user:${user.id}` : `ip:${ip}`,
                },
                ip,
                userAgent: this.securityService.extractUserAgentFromRequest(request),
                timestamp: new Date(),
            });

            // Throw business exception with retry information
            throw BusinessException.rateLimitExceeded(error.msBeforeNext);
        }
    }

    private setRateLimitHeaders(response: any, result: any): void {
        const resetTime = new Date(Date.now() + result.msBeforeNext);

        // Standard rate limit headers
        response.setHeader('X-RateLimit-Limit', result.totalHits || result.consumedPoints);
        response.setHeader('X-RateLimit-Remaining', result.remainingPoints);
        response.setHeader('X-RateLimit-Reset', Math.ceil(resetTime.getTime() / 1000));
        response.setHeader('X-RateLimit-Reset-After', Math.ceil(result.msBeforeNext / 1000));

        // Additional headers for better client experience
        response.setHeader('X-RateLimit-Window', result.windowMs || 60000); // 1 minute default
        response.setHeader('Retry-After', Math.ceil(result.msBeforeNext / 1000));

        // Custom headers for debugging
        response.setHeader('X-RateLimit-Policy', 'sliding-window');
        response.setHeader('X-RateLimit-Identifier', result.identifier || 'unknown');
    }
}
