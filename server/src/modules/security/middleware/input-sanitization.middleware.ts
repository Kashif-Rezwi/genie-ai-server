import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as DOMPurify from 'isomorphic-dompurify';

@Injectable()
export class InputSanitizationMiddleware implements NestMiddleware {
    use(req: Request, res: Response, next: NextFunction) {
        // Sanitize request body
        if (req.body && typeof req.body === 'object') {
            req.body = this.sanitizeObject(req.body);
        }

        // Sanitize query parameters
        if (req.query && typeof req.query === 'object') {
            req.query = this.sanitizeObject(req.query);
        }

        // Sanitize URL parameters
        if (req.params && typeof req.params === 'object') {
            req.params = this.sanitizeObject(req.params);
        }

        next();
    }

    private sanitizeObject(obj: any): any {
        if (obj === null || obj === undefined) {
            return obj;
        }

        if (typeof obj === 'string') {
            return this.sanitizeString(obj);
        }

        if (Array.isArray(obj)) {
            return obj.map(item => this.sanitizeObject(item));
        }

        if (typeof obj === 'object') {
            const sanitized: any = {};
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    sanitized[key] = this.sanitizeObject(obj[key]);
                }
            }
            return sanitized;
        }

        return obj;
    }

    private sanitizeString(str: string): string {
        if (typeof str !== 'string') {
            return str;
        }

        // Remove potential XSS attacks
        let sanitized = DOMPurify.sanitize(str, { 
            ALLOWED_TAGS: [],
            ALLOWED_ATTR: []
        });

        // Remove null bytes and control characters
        sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');

        // Trim whitespace
        sanitized = sanitized.trim();

        return sanitized;
    }
}
