import { Injectable, CanActivate, ExecutionContext, BadRequestException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SetMetadata } from '@nestjs/common';
import { RateLimitService } from '../services/rate-limit.service';
import { SecurityService } from '../services/security.service';

export const RATE_LIMIT_KEY = 'rateLimit';
export const RateLimit = (operation: string, customLimit?: number) =>
    SetMetadata(RATE_LIMIT_KEY, { operation, customLimit });

@Injectable()
export class RateLimitGuard implements CanActivate {
    constructor(
        private readonly rateLimitService: RateLimitService,
        private readonly securityService: SecurityService,
        private readonly reflector: Reflector,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const rateLimitConfig = this.reflector.getAllAndOverride<{
            operation: string;
            customLimit?: number;
        }>(RATE_LIMIT_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        // If no specific rate limit config, apply default global rate limiting
        const operation = rateLimitConfig?.operation || 'api';


        const request = context.switchToHttp().getRequest();
        const response = context.switchToHttp().getResponse();
        const user = request.user;
        const ip = this.securityService.extractIPFromRequest(request);

        try {
            // Check user-specific rate limit if authenticated
            if (user) {
                const result = await this.rateLimitService.checkUserRateLimit(
                    user.id,
                    operation
                );

                // Add rate limit headers
                response.setHeader('X-RateLimit-Limit', result.consumedPoints);
                response.setHeader('X-RateLimit-Remaining', result.remainingPoints);
                response.setHeader('X-RateLimit-Reset', new Date(Date.now() + result.msBeforeNext));
            } else {
                // Check IP-based rate limit for unauthenticated users
                await this.rateLimitService.checkRateLimit('global', ip);
            }

            // Log security event
            await this.securityService.logSecurityEvent({
                userId: user?.id,
                event: 'rate_limit_check',
                details: {
                    operation: operation,
                    endpoint: request.url,
                    method: request.method,
                },
                ip,
                userAgent: this.securityService.extractUserAgentFromRequest(request),
                timestamp: new Date(),
            });

            return true;
        } catch (error) {
            // Log rate limit exceeded
            await this.securityService.logSecurityEvent({
                userId: user?.id,
                event: 'rate_limit_exceeded',
                details: {
                    operation: operation,
                    endpoint: request.url,
                    method: request.method,
                    error: error.message,
                },
                ip,
                userAgent: this.securityService.extractUserAgentFromRequest(request),
                timestamp: new Date(),
            });

            throw error;
        }
    }
}