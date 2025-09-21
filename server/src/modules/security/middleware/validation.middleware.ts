import { Injectable, NestMiddleware, BadRequestException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class ValidationMiddleware implements NestMiddleware {
    use(req: Request, res: Response, next: NextFunction) {
        // Check request size
        const maxSize = parseInt(process.env.MAX_REQUEST_SIZE?.replace('mb', '')) * 1024 * 1024 || 10485760; // 10MB default

        if (req.headers['content-length'] && parseInt(req.headers['content-length']) > maxSize) {
            throw new BadRequestException('Request entity too large');
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
        const botPatterns = [
            /bot|crawler|spider|scraper/i,
            /curl|wget|httpie/i,
        ];

        const isBot = botPatterns.some(pattern => pattern.test(userAgent));

        if (isBot && req.path.includes('/auth/')) {
            throw new BadRequestException('Automated requests not allowed for authentication');
        }
    }
}