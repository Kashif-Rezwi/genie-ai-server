import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';

export interface AuditEvent {
  id: string;
  timestamp: Date;
  userId?: string;
  sessionId?: string;
  ipAddress: string;
  userAgent: string;
  action: string;
  resource: string;
  resourceId?: string;
  details: Record<string, any>;
  severity: 'low' | 'medium' | 'high' | 'critical';
  outcome: 'success' | 'failure' | 'error';
  riskScore: number; // 0-100
  tags: string[];
  metadata: Record<string, any>;
}

export interface AuditQuery {
  userId?: string;
  action?: string;
  resource?: string;
  severity?: string;
  outcome?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface AuditStats {
  totalEvents: number;
  eventsByAction: Record<string, number>;
  eventsBySeverity: Record<string, number>;
  eventsByOutcome: Record<string, number>;
  eventsByUser: Record<string, number>;
  riskScoreDistribution: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  recentHighRiskEvents: AuditEvent[];
  topResources: Array<{ resource: string; count: number }>;
  topActions: Array<{ action: string; count: number }>;
}

/**
 * Audit Logging Service
 * Handles security audit logging and monitoring
 */
@Injectable()
export class AuditLoggingService {
  private readonly logger = new Logger(AuditLoggingService.name);
  private readonly eventPrefix = 'audit:event:';
  private readonly indexPrefix = 'audit:index:';
  private readonly statsPrefix = 'audit:stats:';

  // Sensitive actions that require audit logging
  private readonly sensitiveActions = [
    'user:login',
    'user:logout',
    'user:register',
    'user:password_change',
    'user:password_reset',
    'user:email_change',
    'user:delete',
    'api_key:create',
    'api_key:update',
    'api_key:delete',
    'api_key:deactivate',
    'credits:purchase',
    'credits:transfer',
    'credits:refund',
    'payment:process',
    'payment:refund',
    'admin:user_management',
    'admin:system_config',
    'security:rate_limit_exceeded',
    'security:brute_force_attempt',
    'security:api_key_abuse',
    'security:suspicious_activity',
  ];

  // High-risk actions
  private readonly highRiskActions = [
    'user:delete',
    'user:password_change',
    'api_key:delete',
    'credits:transfer',
    'payment:refund',
    'admin:user_management',
    'admin:system_config',
    'security:api_key_abuse',
    'security:suspicious_activity',
  ];

  constructor(@InjectRedis() private readonly redis: Redis) {}

  /**
   * Log audit event
   * @param event - Audit event data
   * @returns Promise<string> - Event ID
   */
  async logEvent(event: Partial<AuditEvent>): Promise<string> {
    try {
      const eventId = this.generateEventId();
      const timestamp = new Date();
      
      const auditEvent: AuditEvent = {
        id: eventId,
        timestamp,
        userId: event.userId,
        sessionId: event.sessionId,
        ipAddress: event.ipAddress || 'unknown',
        userAgent: event.userAgent || 'unknown',
        action: event.action || 'unknown',
        resource: event.resource || 'unknown',
        resourceId: event.resourceId,
        details: event.details || {},
        severity: event.severity || this.calculateSeverity(event.action || 'unknown'),
        outcome: event.outcome || 'success',
        riskScore: event.riskScore || this.calculateRiskScore(event),
        tags: event.tags || this.generateTags(event),
        metadata: event.metadata || {},
      };

      // Store event
      await this.storeEvent(auditEvent);

      // Update indexes
      await this.updateIndexes(auditEvent);

      // Update statistics
      await this.updateStats(auditEvent);

      // Check for high-risk events
      if (auditEvent.riskScore >= 70) {
        await this.handleHighRiskEvent(auditEvent);
      }

      this.logger.log(`Audit event logged: ${auditEvent.action} (${auditEvent.id})`);
      return eventId;
    } catch (error) {
      this.logger.error('Audit logging error:', error);
      throw error;
    }
  }

  /**
   * Query audit events
   * @param query - Query parameters
   * @returns Promise<AuditEvent[]> - Matching events
   */
  async queryEvents(query: AuditQuery): Promise<AuditEvent[]> {
    try {
      const limit = query.limit || 100;
      const offset = query.offset || 0;

      // Build search keys
      const searchKeys: string[] = [];
      
      if (query.userId) {
        searchKeys.push(`${this.indexPrefix}user:${query.userId}`);
      }
      if (query.action) {
        searchKeys.push(`${this.indexPrefix}action:${query.action}`);
      }
      if (query.resource) {
        searchKeys.push(`${this.indexPrefix}resource:${query.resource}`);
      }
      if (query.severity) {
        searchKeys.push(`${this.indexPrefix}severity:${query.severity}`);
      }
      if (query.outcome) {
        searchKeys.push(`${this.indexPrefix}outcome:${query.outcome}`);
      }

      if (searchKeys.length === 0) {
        // Get all events if no specific filters
        searchKeys.push(`${this.indexPrefix}all`);
      }

      // Get event IDs from indexes
      const eventIds = await this.getEventIdsFromIndexes(searchKeys, query.startDate, query.endDate);
      
      // Sort by timestamp (newest first)
      eventIds.sort((a, b) => b.timestamp - a.timestamp);
      
      // Apply pagination
      const paginatedIds = eventIds.slice(offset, offset + limit);
      
      // Fetch events
      const events: AuditEvent[] = [];
      for (const { id } of paginatedIds) {
        const event = await this.getEvent(id);
        if (event) {
          events.push(event);
        }
      }

      return events;
    } catch (error) {
      this.logger.error('Query audit events error:', error);
      throw error;
    }
  }

  /**
   * Get audit statistics
   * @param startDate - Start date
   * @param endDate - End date
   * @returns Promise<AuditStats> - Audit statistics
   */
  async getAuditStats(startDate?: Date, endDate?: Date): Promise<AuditStats> {
    try {
      const statsKey = `${this.statsPrefix}${this.getDateKey(startDate || new Date())}`;
      const stats = await this.redis.hgetall(statsKey);

      return {
        totalEvents: parseInt(stats.totalEvents || '0'),
        eventsByAction: this.parseJsonField(stats.eventsByAction) || {},
        eventsBySeverity: this.parseJsonField(stats.eventsBySeverity) || {},
        eventsByOutcome: this.parseJsonField(stats.eventsByOutcome) || {},
        eventsByUser: this.parseJsonField(stats.eventsByUser) || {},
        riskScoreDistribution: this.parseJsonField(stats.riskScoreDistribution) || {
          low: 0,
          medium: 0,
          high: 0,
          critical: 0,
        },
        recentHighRiskEvents: this.parseJsonField(stats.recentHighRiskEvents) || [],
        topResources: this.parseJsonField(stats.topResources) || [],
        topActions: this.parseJsonField(stats.topActions) || [],
      };
    } catch (error) {
      this.logger.error('Get audit stats error:', error);
      throw error;
    }
  }

  /**
   * Get event by ID
   * @param eventId - Event ID
   * @returns Promise<AuditEvent | null> - Event or null
   */
  async getEvent(eventId: string): Promise<AuditEvent | null> {
    try {
      const key = `${this.eventPrefix}${eventId}`;
      const eventData = await this.redis.get(key);
      
      if (!eventData) {
        return null;
      }

      const event = JSON.parse(eventData) as AuditEvent;
      event.timestamp = new Date(event.timestamp);
      
      return event;
    } catch (error) {
      this.logger.error(`Get event error for ${eventId}:`, error);
      return null;
    }
  }

  /**
   * Delete old audit events
   * @param olderThanDays - Delete events older than this many days
   * @returns Promise<number> - Number of events deleted
   */
  async cleanupOldEvents(olderThanDays: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
      const cutoffTimestamp = cutoffDate.getTime();

      // Get all event keys
      const eventKeys = await this.redis.keys(`${this.eventPrefix}*`);
      let deletedCount = 0;

      for (const key of eventKeys) {
        const eventData = await this.redis.get(key);
        if (eventData) {
          const event = JSON.parse(eventData) as AuditEvent;
          if (new Date(event.timestamp).getTime() < cutoffTimestamp) {
            await this.redis.del(key);
            deletedCount++;
          }
        }
      }

      this.logger.log(`Cleaned up ${deletedCount} old audit events`);
      return deletedCount;
    } catch (error) {
      this.logger.error('Cleanup old events error:', error);
      return 0;
    }
  }

  /**
   * Store audit event
   * @param event - Audit event
   * @returns Promise<void>
   */
  private async storeEvent(event: AuditEvent): Promise<void> {
    const key = `${this.eventPrefix}${event.id}`;
    const eventData = JSON.stringify(event);
    
    // Store for 1 year
    await this.redis.setex(key, 365 * 24 * 60 * 60, eventData);
  }

  /**
   * Update indexes
   * @param event - Audit event
   * @returns Promise<void>
   */
  private async updateIndexes(event: AuditEvent): Promise<void> {
    const timestamp = event.timestamp.getTime();
    const pipeline = this.redis.pipeline();

    // Add to all events index
    pipeline.zadd(`${this.indexPrefix}all`, timestamp, event.id);

    // Add to user index
    if (event.userId) {
      pipeline.zadd(`${this.indexPrefix}user:${event.userId}`, timestamp, event.id);
    }

    // Add to action index
    pipeline.zadd(`${this.indexPrefix}action:${event.action}`, timestamp, event.id);

    // Add to resource index
    pipeline.zadd(`${this.indexPrefix}resource:${event.resource}`, timestamp, event.id);

    // Add to severity index
    pipeline.zadd(`${this.indexPrefix}severity:${event.severity}`, timestamp, event.id);

    // Add to outcome index
    pipeline.zadd(`${this.indexPrefix}outcome:${event.outcome}`, timestamp, event.id);

    // Set expiration for indexes (1 year)
    const expireTime = 365 * 24 * 60 * 60;
    pipeline.expire(`${this.indexPrefix}all`, expireTime);
    if (event.userId) {
      pipeline.expire(`${this.indexPrefix}user:${event.userId}`, expireTime);
    }
    pipeline.expire(`${this.indexPrefix}action:${event.action}`, expireTime);
    pipeline.expire(`${this.indexPrefix}resource:${event.resource}`, expireTime);
    pipeline.expire(`${this.indexPrefix}severity:${event.severity}`, expireTime);
    pipeline.expire(`${this.indexPrefix}outcome:${event.outcome}`, expireTime);

    await pipeline.exec();
  }

  /**
   * Update statistics
   * @param event - Audit event
   * @returns Promise<void>
   */
  private async updateStats(event: AuditEvent): Promise<void> {
    const statsKey = `${this.statsPrefix}${this.getDateKey(event.timestamp)}`;
    const pipeline = this.redis.pipeline();

    // Increment counters
    pipeline.hincrby(statsKey, 'totalEvents', 1);
    pipeline.hincrby(statsKey, `eventsByAction:${event.action}`, 1);
    pipeline.hincrby(statsKey, `eventsBySeverity:${event.severity}`, 1);
    pipeline.hincrby(statsKey, `eventsByOutcome:${event.outcome}`, 1);
    
    if (event.userId) {
      pipeline.hincrby(statsKey, `eventsByUser:${event.userId}`, 1);
    }

    // Update risk score distribution
    if (event.riskScore >= 80) {
      pipeline.hincrby(statsKey, 'riskScoreDistribution:critical', 1);
    } else if (event.riskScore >= 60) {
      pipeline.hincrby(statsKey, 'riskScoreDistribution:high', 1);
    } else if (event.riskScore >= 40) {
      pipeline.hincrby(statsKey, 'riskScoreDistribution:medium', 1);
    } else {
      pipeline.hincrby(statsKey, 'riskScoreDistribution:low', 1);
    }

    // Set expiration (30 days)
    pipeline.expire(statsKey, 30 * 24 * 60 * 60);

    await pipeline.exec();
  }

  /**
   * Handle high-risk event
   * @param event - High-risk audit event
   * @returns Promise<void>
   */
  private async handleHighRiskEvent(event: AuditEvent): Promise<void> {
    try {
      // Log high-risk event
      this.logger.warn(`High-risk audit event detected: ${event.action} (${event.id})`, {
        userId: event.userId,
        ipAddress: event.ipAddress,
        riskScore: event.riskScore,
        details: event.details,
      });

      // Store in high-risk events list
      const highRiskKey = `${this.statsPrefix}high_risk_events`;
      await this.redis.lpush(highRiskKey, JSON.stringify(event));
      await this.redis.ltrim(highRiskKey, 0, 99); // Keep only last 100 events
      await this.redis.expire(highRiskKey, 7 * 24 * 60 * 60); // 7 days

      // In production, you would trigger alerts here
      // For now, we just log it
    } catch (error) {
      this.logger.error('Handle high-risk event error:', error);
    }
  }

  /**
   * Get event IDs from indexes
   * @param searchKeys - Search keys
   * @param startDate - Start date
   * @param endDate - End date
   * @returns Promise<Array<{id: string, timestamp: number}>> - Event IDs with timestamps
   */
  private async getEventIdsFromIndexes(
    searchKeys: string[],
    startDate?: Date,
    endDate?: Date,
  ): Promise<Array<{ id: string; timestamp: number }>> {
    const minScore = startDate ? startDate.getTime() : 0;
    const maxScore = endDate ? endDate.getTime() : '+inf';

    const pipeline = this.redis.pipeline();
    
    for (const key of searchKeys) {
      pipeline.zrevrangebyscore(key, maxScore, minScore, 'WITHSCORES');
    }

    const results = await pipeline.exec();
    const eventIds: Array<{ id: string; timestamp: number }> = [];

    if (results) {
      for (const result of results) {
        if (result[0] === null && result[1]) {
          const data = result[1] as string[];
          for (let i = 0; i < data.length; i += 2) {
            eventIds.push({
              id: data[i],
              timestamp: parseInt(data[i + 1]),
            });
          }
        }
      }
    }

    return eventIds;
  }

  /**
   * Calculate severity based on action
   * @param action - Action name
   * @returns string - Severity level
   */
  private calculateSeverity(action: string): 'low' | 'medium' | 'high' | 'critical' {
    if (this.highRiskActions.includes(action)) {
      return 'critical';
    }
    if (this.sensitiveActions.includes(action)) {
      return 'high';
    }
    return 'medium';
  }

  /**
   * Calculate risk score
   * @param event - Partial audit event
   * @returns number - Risk score (0-100)
   */
  private calculateRiskScore(event: Partial<AuditEvent>): number {
    let score = 0;

    // Base score by action
    if (this.highRiskActions.includes(event.action || '')) {
      score += 40;
    } else if (this.sensitiveActions.includes(event.action || '')) {
      score += 20;
    }

    // Outcome penalty
    if (event.outcome === 'failure') {
      score += 20;
    } else if (event.outcome === 'error') {
      score += 30;
    }

    // IP address risk (simplified)
    if (event.ipAddress && event.ipAddress !== 'unknown') {
      if (event.ipAddress.includes('192.168.') || event.ipAddress.includes('10.')) {
        score += 5; // Internal IP
      } else if (event.ipAddress.includes('127.0.0.1')) {
        score += 0; // Localhost
      } else {
        score += 10; // External IP
      }
    }

    // User agent risk
    if (event.userAgent && event.userAgent !== 'unknown') {
      if (event.userAgent.includes('bot') || event.userAgent.includes('crawler')) {
        score += 15;
      }
    }

    return Math.min(score, 100);
  }

  /**
   * Generate tags for event
   * @param event - Partial audit event
   * @returns string[] - Event tags
   */
  private generateTags(event: Partial<AuditEvent>): string[] {
    const tags: string[] = [];

    if (event.userId) {
      tags.push('authenticated');
    } else {
      tags.push('anonymous');
    }

    if (this.sensitiveActions.includes(event.action || '')) {
      tags.push('sensitive');
    }

    if (this.highRiskActions.includes(event.action || '')) {
      tags.push('high-risk');
    }

    if (event.outcome === 'failure' || event.outcome === 'error') {
      tags.push('failed');
    }

    return tags;
  }

  /**
   * Generate event ID
   * @returns string - Event ID
   */
  private generateEventId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get date key for statistics
   * @param date - Date
   * @returns string - Date key
   */
  private getDateKey(date: Date): string {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD
  }

  /**
   * Parse JSON field
   * @param field - JSON field
   * @returns any - Parsed field
   */
  private parseJsonField(field: string | undefined): any {
    if (!field) {
      return null;
    }
    try {
      return JSON.parse(field);
    } catch {
      return null;
    }
  }
}
