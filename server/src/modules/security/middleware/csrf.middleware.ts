import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RedisService } from '../../redis/redis.service';
import { getClientIP } from '../../../common/utils/request.utils';

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
    private readonly logger = new Logger(CsrfMiddleware.name);
    private readonly CSRF_TOKEN_LENGTH = 32;
    private readonly CSRF_TOKEN_TTL = 3600; // 1 hour

    constructor(private readonly redisService: RedisService) {}

    async use(req: Request, res: Response, next: NextFunction) {
        // Skip CSRF for safe methods and health checks
        if (this.isSafeMethod(req) || this.isHealthEndpoint(req)) {
            return next();
        }

        // Skip CSRF for webhook endpoints (they use signature verification)
        if (this.isWebhookEndpoint(req)) {
            return next();
        }

        // Skip CSRF for API endpoints with proper authentication (JWT)
        if (this.isAuthenticatedApiRequest(req)) {
            return next();
        }

        const token = req.headers['x-csrf-token'] as string;
        const sessionId = this.getSessionId(req);

        if (!token || !sessionId) {
            this.logger.warn(`CSRF token missing for ${req.method} ${req.path}`, {
                ip: getClientIP(req),
                userAgent: req.get('User-Agent'),
                sessionId: sessionId || 'missing',
            });

            return res.status(403).json({
                error: 'CSRF token missing',
                message: 'Please include X-CSRF-Token and X-Session-ID headers',
                code: 'CSRF_TOKEN_MISSING',
            });
        }

        // Verify CSRF token
        const isValid = await this.verifyToken(sessionId, token);

        if (!isValid) {
            this.logger.warn(`Invalid CSRF token for ${req.method} ${req.path}`, {
                ip: getClientIP(req),
                userAgent: req.get('User-Agent'),
                sessionId,
                tokenLength: token.length,
            });

            return res.status(403).json({
                error: 'Invalid CSRF token',
                message: 'CSRF token verification failed',
                code: 'CSRF_TOKEN_INVALID',
            });
        }

        next();
    }

    private isSafeMethod(req: Request): boolean {
        return ['GET', 'HEAD', 'OPTIONS'].includes(req.method);
    }

    private isHealthEndpoint(req: Request): boolean {
        return (
            req.path.includes('/health') ||
            req.path.includes('/monitoring') ||
            req.path.includes('/docs')
        );
    }

    private isWebhookEndpoint(req: Request): boolean {
        return req.path.includes('/webhook');
    }

    private isAuthenticatedApiRequest(req: Request): boolean {
        return (
            req.path.startsWith('/api/') &&
            !!req.headers.authorization &&
            req.headers.authorization.startsWith('Bearer ')
        );
    }

    private getSessionId(req: Request): string | null {
        return (
            (req.headers['x-session-id'] as string) ||
            (req as any).sessionID ||
            (req as any).session?.id
        );
    }

    // Generate CSRF token for a session
    async generateToken(sessionId: string): Promise<string> {
        // Generate cryptographically secure token
        const token = this.generateSecureToken();
        const key = `csrf:${sessionId}`;

        try {
            await this.redisService.set(key, token, this.CSRF_TOKEN_TTL);
            this.logger.debug(`Generated CSRF token for session: ${sessionId}`);
            return token;
        } catch (error) {
            this.logger.error(`Failed to store CSRF token for session ${sessionId}:`, error);
            throw new Error('Failed to generate CSRF token');
        }
    }

    // Verify CSRF token
    async verifyToken(sessionId: string, token: string): Promise<boolean> {
        if (!token || token.length !== this.CSRF_TOKEN_LENGTH) {
            return false;
        }

        try {
            const key = `csrf:${sessionId}`;
            const storedToken = await this.redisService.get(key);

            if (!storedToken) {
                this.logger.debug(`No stored CSRF token found for session: ${sessionId}`);
                return false;
            }

            const isValid = storedToken === token;

            if (isValid) {
                // Refresh token TTL on successful verification
                await this.redisService.expire(key, this.CSRF_TOKEN_TTL);
            }

            return isValid;
        } catch (error) {
            this.logger.error(`Failed to verify CSRF token for session ${sessionId}:`, error);
            return false;
        }
    }

    // Generate cryptographically secure token
    private generateSecureToken(): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < this.CSRF_TOKEN_LENGTH; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    // Invalidate CSRF token
    async invalidateToken(sessionId: string): Promise<void> {
        try {
            const key = `csrf:${sessionId}`;
            await this.redisService.del(key);
            this.logger.debug(`Invalidated CSRF token for session: ${sessionId}`);
        } catch (error) {
            this.logger.error(`Failed to invalidate CSRF token for session ${sessionId}:`, error);
        }
    }
}
