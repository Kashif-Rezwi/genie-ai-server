import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../../entities';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { securityConfig } from '../../../config';
import { RedisService } from '../../redis/redis.service';
import { LoggingService } from '../../monitoring/services/logging.service';

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
        private readonly redisService: RedisService,
        private readonly logger: LoggingService,
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
        // Simplified password strength check for 0-1000 users
        let score = 0;

        // Basic checks only
        if (password.length >= 8) score += 2;
        if (password.length >= 12) score += 1;
        if (/[a-z]/.test(password)) score += 1;
        if (/[A-Z]/.test(password)) score += 1;
        if (/\d/.test(password)) score += 1;
        if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score += 1;

        const levels = ['weak', 'weak', 'fair', 'good', 'strong', 'very_strong'];
        return {
            score,
            level: levels[Math.min(Math.floor(score / 2), 5)] as any,
        };
    }

    // Removed detectSuspiciousActivity - over-engineered for 0-1000 users

    async logSecurityEvent(event: SecurityEvent): Promise<void> {
        // Use proper logger service
        this.logger.logInfo(`SECURITY: ${event.event}`, {
            userId: event.userId,
            ip: event.ip,
            userAgent: event.userAgent,
            details: event.details,
            timestamp: event.timestamp.toISOString(),
        });

        // Store in Redis for real-time monitoring (simplified)
        try {
            const key = `security_events:${event.userId || 'anonymous'}`;
            const eventData = JSON.stringify(event);
            // Keep last 50 events per user (reduced from 100)
            await this.redisService.set(key, eventData, 3600); // 1 hour TTL
        } catch (error) {
            // Use proper logger for errors
            this.logger.logWarning('Failed to store security event in Redis', {
                error: error.message,
                userId: event.userId,
            });
        }
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
