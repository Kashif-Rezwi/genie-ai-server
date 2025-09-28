import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SetMetadata } from '@nestjs/common';
import { ApiKeyService } from '../services/api-key.service';
import { SecurityService } from '../services/security.service';
import { securityConfig } from '../../../config';

export const API_KEY_REQUIRED = 'apiKeyRequired';
export const RequireApiKey = (permission?: string) =>
    SetMetadata(API_KEY_REQUIRED, permission || 'api:access');

@Injectable()
export class ApiKeyGuard implements CanActivate {
    private readonly config = securityConfig();

    constructor(
        private readonly apiKeyService: ApiKeyService,
        private readonly securityService: SecurityService,
        private readonly reflector: Reflector,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const requiredPermission = this.reflector.getAllAndOverride<string>(API_KEY_REQUIRED, [
            context.getHandler(),
            context.getClass(),
        ]);

        if (!requiredPermission) {
            return true;
        }

        const request = context.switchToHttp().getRequest();
        const rawApiKey = request.headers[this.config.apiKey.header];

        if (!rawApiKey) {
            throw new UnauthorizedException('API key required');
        }

        const validation = await this.apiKeyService.validateApiKey(rawApiKey);

        if (!validation.isValid || !validation.apiKey || !validation.user) {
            throw new UnauthorizedException('Invalid API key');
        }

        // Check permission
        const hasPermission = await this.apiKeyService.hasPermission(
            validation.apiKey,
            requiredPermission,
        );

        if (!hasPermission) {
            throw new UnauthorizedException('Insufficient API key permissions');
        }

        // Add API key and user to request
        request.apiKey = validation.apiKey;
        request.user = validation.user;

        // Log API key usage
        await this.securityService.logSecurityEvent({
            userId: validation.user.id,
            event: 'api_key_used',
            details: {
                keyId: validation.apiKey.id,
                keyName: validation.apiKey.name,
                permission: requiredPermission,
                endpoint: request.url,
                method: request.method,
            },
            ip: this.securityService.extractIPFromRequest(request),
            userAgent: this.securityService.extractUserAgentFromRequest(request),
            timestamp: new Date(),
        });

        return true;
    }
}
