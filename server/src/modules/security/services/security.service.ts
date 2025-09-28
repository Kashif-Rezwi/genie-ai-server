import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../../entities';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { securityConfig } from '../../../config';

export interface SecurityEvent {
    userId?: string;
    event: string;
    details: Record<string, any>;
    ip: string;
    userAgent: string;
    timestamp: Date;
}

@Injectable()
export class SecurityService {
    private readonly config = securityConfig();

    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
    ) {}

    async hashPassword(password: string): Promise<string> {
        return bcrypt.hash(password, this.config.bcrypt.rounds);
    }

    async comparePassword(password: string, hash: string): Promise<boolean> {
        return bcrypt.compare(password, hash);
    }

    generateSecureToken(length: number = 32): string {
        return crypto.randomBytes(length).toString('hex');
    }

    generateApiKey(): string {
        const prefix = 'genie_';
        const randomPart = crypto.randomBytes(24).toString('hex');
        return `${prefix}${randomPart}`;
    }

    hashApiKey(apiKey: string): string {
        return crypto.createHash('sha256').update(apiKey).digest('hex');
    }

    sanitizeInput(input: string): string {
        // Remove potentially dangerous characters
        return input
            .replace(/[<>\"'%;()&+]/g, '') // Basic XSS prevention
            .trim()
            .substring(0, 1000); // Limit length
    }

    validateEmail(email: string): boolean {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    validatePassword(password: string): { isValid: boolean; errors: string[] } {
        const errors: string[] = [];

        if (password.length < 8) {
            errors.push('Password must be at least 8 characters long');
        }

        if (!/[A-Z]/.test(password)) {
            errors.push('Password must contain at least one uppercase letter');
        }

        if (!/[a-z]/.test(password)) {
            errors.push('Password must contain at least one lowercase letter');
        }

        if (!/\d/.test(password)) {
            errors.push('Password must contain at least one number');
        }

        if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
            errors.push('Password must contain at least one special character');
        }

        return {
            isValid: errors.length === 0,
            errors,
        };
    }

    checkPasswordStrength(password: string): {
        score: number;
        level: 'weak' | 'fair' | 'good' | 'strong' | 'very_strong';
    } {
        let score = 0;

        // Length check
        if (password.length >= 8) score += 1;
        if (password.length >= 12) score += 1;
        if (password.length >= 16) score += 1;

        // Character variety
        if (/[a-z]/.test(password)) score += 1;
        if (/[A-Z]/.test(password)) score += 1;
        if (/\d/.test(password)) score += 1;
        if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score += 1;

        // Pattern checks
        if (!/(.)\1{2,}/.test(password)) score += 1; // No repeating characters
        if (!/123|abc|qwe|password|admin/i.test(password)) score += 1; // No common patterns

        const levels = [
            'weak',
            'weak',
            'fair',
            'fair',
            'good',
            'good',
            'strong',
            'strong',
            'very_strong',
        ];

        return {
            score,
            level: levels[Math.min(score, 8)] as any,
        };
    }

    detectSuspiciousActivity(events: SecurityEvent[]): boolean {
        // Check for suspicious patterns
        const recentEvents = events.filter(
            event => Date.now() - event.timestamp.getTime() < 300000, // 5 minutes
        );

        // Too many failed login attempts
        const failedLogins = recentEvents.filter(event => event.event === 'login_failed');
        if (failedLogins.length >= 5) return true;

        // Multiple IPs for same user
        const uniqueIPs = new Set(recentEvents.map(event => event.ip));
        if (uniqueIPs.size >= 3) return true;

        // Unusual API usage patterns
        const apiCalls = recentEvents.filter(event => event.event === 'api_call');
        if (apiCalls.length >= 100) return true;

        return false;
    }

    async logSecurityEvent(event: SecurityEvent): Promise<void> {
        // In production, this would go to a security logging service
        console.log(`[SECURITY] ${event.event}:`, {
            userId: event.userId,
            ip: event.ip,
            userAgent: event.userAgent,
            details: event.details,
            timestamp: event.timestamp,
        });

        // Store in Redis for real-time monitoring
        const key = `security_events:${event.userId || 'anonymous'}`;
        const eventData = JSON.stringify(event);

        // Keep last 100 events per user
        // This would be better implemented with a proper logging service
    }

    isValidJWT(token: string): boolean {
        try {
            // Basic JWT format validation
            const parts = token.split('.');
            return parts.length === 3;
        } catch {
            return false;
        }
    }

    extractIPFromRequest(req: any): string {
        return (
            req.ip ||
            req.connection?.remoteAddress ||
            req.socket?.remoteAddress ||
            req.headers['x-forwarded-for']?.split(',')[0] ||
            'unknown'
        );
    }

    extractUserAgentFromRequest(req: any): string {
        return req.headers['user-agent'] || 'unknown';
    }
}
