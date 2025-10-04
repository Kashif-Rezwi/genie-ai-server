import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
    constructor(private readonly redisService: RedisService) {}

    async use(req: Request, res: Response, next: NextFunction) {
        // Skip CSRF for GET requests and health checks
        if (req.method === 'GET' || req.path.includes('/health') || req.path.includes('/monitoring')) {
            return next();
        }

        // Skip CSRF for webhook endpoints (they use signature verification)
        if (req.path.includes('/webhook')) {
            return next();
        }

        // Skip CSRF for API endpoints with proper authentication
        if (req.path.startsWith('/api/') && req.headers.authorization) {
            return next();
        }

        const token = req.headers['x-csrf-token'] as string;
        const sessionId = req.headers['x-session-id'] as string || (req as any).sessionID;

        if (!token || !sessionId) {
            return res.status(403).json({
                error: 'CSRF token missing',
                message: 'Please include X-CSRF-Token and X-Session-ID headers'
            });
        }

        // Verify CSRF token
        const storedToken = await this.redisService.get(`csrf:${sessionId}`);
        
        if (!storedToken || storedToken !== token) {
            return res.status(403).json({
                error: 'Invalid CSRF token',
                message: 'CSRF token verification failed'
            });
        }

        next();
    }

    // Generate CSRF token for a session
    async generateToken(sessionId: string): Promise<string> {
        const token = uuidv4();
        await this.redisService.set(`csrf:${sessionId}`, token, 3600); // 1 hour TTL
        return token;
    }

    // Verify CSRF token
    async verifyToken(sessionId: string, token: string): Promise<boolean> {
        const storedToken = await this.redisService.get(`csrf:${sessionId}`);
        return storedToken === token;
    }
}
