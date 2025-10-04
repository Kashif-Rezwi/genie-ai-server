import { Injectable } from '@nestjs/common';
import { LoggingService } from '../../monitoring/services/logging.service';
import { RedisService } from '../../redis/redis.service';

export interface AuditEvent {
    userId?: string;
    action: string;
    resource: string;
    details?: any;
    ip?: string;
    userAgent?: string;
    timestamp: Date;
    severity: 'low' | 'medium' | 'high' | 'critical';
}

@Injectable()
export class AuditService {
    constructor(
        private readonly loggingService: LoggingService,
        private readonly redisService: RedisService,
    ) {}

    async logEvent(event: Omit<AuditEvent, 'timestamp'>): Promise<void> {
        const auditEvent: AuditEvent = {
            ...event,
            timestamp: new Date(),
        };

        // Log to structured logging
        this.loggingService.logInfo('Audit Event', {
            ...auditEvent,
            category: 'security',
        });

        // Store in Redis for quick access (with TTL)
        const key = `audit:${auditEvent.userId || 'anonymous'}:${Date.now()}`;
        await this.redisService.set(key, JSON.stringify(auditEvent), 86400); // 24 hours

        // For critical events, also log to error level
        if (auditEvent.severity === 'critical') {
            this.loggingService.logError('Critical Security Event', new Error(JSON.stringify(auditEvent)));
        }
    }

    async getUserAuditLog(userId: string, limit: number = 100): Promise<AuditEvent[]> {
        const pattern = `audit:${userId}:*`;
        const keys = await this.redisService.keys(pattern);
        
        if (keys.length === 0) return [];

        // Get the most recent events
        const sortedKeys = keys.sort().slice(-limit);
        const events = await this.redisService.getMultiple(sortedKeys);
        
        return events
            .filter(event => event !== null)
            .map(event => JSON.parse(event!))
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }

    async logAuthenticationEvent(userId: string, action: 'login' | 'logout' | 'failed_login', ip?: string, userAgent?: string): Promise<void> {
        await this.logEvent({
            userId,
            action,
            resource: 'authentication',
            ip,
            userAgent,
            severity: action === 'failed_login' ? 'high' : 'medium',
        });
    }

    async logCreditEvent(userId: string, action: string, amount: number, details?: any): Promise<void> {
        await this.logEvent({
            userId,
            action,
            resource: 'credits',
            details: { amount, ...details },
            severity: 'medium',
        });
    }

    async logSecurityEvent(action: string, resource: string, details?: any, severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'): Promise<void> {
        await this.logEvent({
            action,
            resource,
            details,
            severity,
        });
    }
}
