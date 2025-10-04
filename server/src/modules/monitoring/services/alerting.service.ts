import { Injectable } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
import { LoggingService } from './logging.service';
import { EmailService } from '../../email/email.service';

export interface AlertRule {
    id: string;
    name: string;
    condition: (data: any) => boolean;
    severity: 'low' | 'medium' | 'high' | 'critical';
    cooldown: number; // seconds
    enabled: boolean;
}

export interface Alert {
    id: string;
    ruleId: string;
    title: string;
    message: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    timestamp: Date;
    resolved: boolean;
    resolvedAt?: Date;
    data: Record<string, any>;
}

export interface AlertChannel {
    type: 'email' | 'webhook' | 'slack' | 'discord';
    config: Record<string, any>;
    enabled: boolean;
}

@Injectable()
export class AlertingService {
    private readonly alertRules: Map<string, AlertRule> = new Map();
    private readonly alertChannels: Map<string, AlertChannel> = new Map();
    private readonly alertCooldowns: Map<string, number> = new Map();

    constructor(
        private readonly redisService: RedisService,
        private readonly loggingService: LoggingService,
        private readonly emailService?: EmailService,
    ) {
        this.initializeDefaultRules();
        this.initializeDefaultChannels();
    }

    private initializeDefaultRules(): void {
        // High error rate alert
        this.addAlertRule({
            id: 'high_error_rate',
            name: 'High Error Rate',
            condition: (data) => data.errorRate > 0.1, // 10% error rate
            severity: 'high',
            cooldown: 300, // 5 minutes
            enabled: true,
        });

        // High response time alert
        this.addAlertRule({
            id: 'high_response_time',
            name: 'High Response Time',
            condition: (data) => data.avgResponseTime > 5000, // 5 seconds
            severity: 'medium',
            cooldown: 600, // 10 minutes
            enabled: true,
        });

        // Memory usage alert
        this.addAlertRule({
            id: 'high_memory_usage',
            name: 'High Memory Usage',
            condition: (data) => data.memoryUsage > 0.8, // 80% memory usage
            severity: 'high',
            cooldown: 300, // 5 minutes
            enabled: true,
        });

        // Database connection alert
        this.addAlertRule({
            id: 'database_down',
            name: 'Database Connection Failed',
            condition: (data) => data.databaseStatus === 'down',
            severity: 'critical',
            cooldown: 60, // 1 minute
            enabled: true,
        });

        // Redis connection alert
        this.addAlertRule({
            id: 'redis_down',
            name: 'Redis Connection Failed',
            condition: (data) => data.redisStatus === 'down',
            severity: 'high',
            cooldown: 120, // 2 minutes
            enabled: true,
        });

        // Security breach alert
        this.addAlertRule({
            id: 'security_breach',
            name: 'Security Breach Detected',
            condition: (data) => data.securityEvents > 5, // 5 security events in time window
            severity: 'critical',
            cooldown: 0, // No cooldown for security alerts
            enabled: true,
        });

        // Payment failure alert
        this.addAlertRule({
            id: 'payment_failure',
            name: 'Payment Processing Failure',
            condition: (data) => data.paymentFailures > 3, // 3 payment failures
            severity: 'high',
            cooldown: 300, // 5 minutes
            enabled: true,
        });

        // Rate limit exceeded alert
        this.addAlertRule({
            id: 'rate_limit_exceeded',
            name: 'Rate Limit Exceeded',
            condition: (data) => data.rateLimitExceeded > 10, // 10 rate limit violations
            severity: 'medium',
            cooldown: 600, // 10 minutes
            enabled: true,
        });
    }

    private initializeDefaultChannels(): void {
        // Email channel
        this.addAlertChannel({
            type: 'email',
            config: {
                to: process.env.ALERT_EMAIL || 'admin@genie-ai.com',
                from: process.env.SMTP_FROM || 'alerts@genie-ai.com',
            },
            enabled: true,
        });

        // Webhook channel (for future integration)
        this.addAlertChannel({
            type: 'webhook',
            config: {
                url: process.env.ALERT_WEBHOOK_URL,
            },
            enabled: !!process.env.ALERT_WEBHOOK_URL,
        });
    }

    addAlertRule(rule: AlertRule): void {
        this.alertRules.set(rule.id, rule);
        this.loggingService.logInfo(`Alert rule added: ${rule.name}`, {
            ruleId: rule.id,
            severity: rule.severity,
        });
    }

    addAlertChannel(channel: AlertChannel): void {
        const channelId = `${channel.type}_${Date.now()}`;
        this.alertChannels.set(channelId, channel);
        this.loggingService.logInfo(`Alert channel added: ${channel.type}`, {
            channelId,
            enabled: channel.enabled,
        });
    }

    async processMetrics(metrics: Record<string, any>): Promise<void> {
        for (const [ruleId, rule] of this.alertRules) {
            if (!rule.enabled) continue;

            // Check cooldown
            const lastAlert = this.alertCooldowns.get(ruleId);
            if (lastAlert && Date.now() - lastAlert < rule.cooldown * 1000) {
                continue;
            }

            // Check condition
            if (rule.condition(metrics)) {
                await this.triggerAlert(rule, metrics);
                this.alertCooldowns.set(ruleId, Date.now());
            }
        }
    }

    async triggerAlert(rule: AlertRule, data: Record<string, any>): Promise<void> {
        const alert: Alert = {
            id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            ruleId: rule.id,
            title: rule.name,
            message: this.generateAlertMessage(rule, data),
            severity: rule.severity,
            timestamp: new Date(),
            resolved: false,
            data,
        };

        // Store alert in Redis
        await this.storeAlert(alert);

        // Send to all enabled channels
        await this.sendAlert(alert);

        this.loggingService.logError(`Alert triggered: ${rule.name}`, undefined, {
            alertId: alert.id,
            severity: rule.severity,
            data,
        });
    }

    async resolveAlert(alertId: string): Promise<void> {
        const alert = await this.getAlert(alertId);
        if (alert && !alert.resolved) {
            alert.resolved = true;
            alert.resolvedAt = new Date();
            await this.storeAlert(alert);

            this.loggingService.logInfo(`Alert resolved: ${alert.title}`, {
                alertId: alert.id,
                resolvedAt: alert.resolvedAt,
            });
        }
    }

    async getActiveAlerts(): Promise<Alert[]> {
        try {
            const keys = await this.redisService.keys('alert:*');
            const alerts: Alert[] = [];

            for (const key of keys) {
                const alertData = await this.redisService.get(key);
                if (alertData) {
                    const alert = JSON.parse(alertData);
                    if (!alert.resolved) {
                        alerts.push(alert);
                    }
                }
            }

            return alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        } catch (error) {
            this.loggingService.logError('Failed to get active alerts', error);
            return [];
        }
    }

    async getAlertHistory(limit: number = 50): Promise<Alert[]> {
        try {
            const keys = await this.redisService.keys('alert:*');
            const alerts: Alert[] = [];

            for (const key of keys.slice(0, limit)) {
                const alertData = await this.redisService.get(key);
                if (alertData) {
                    alerts.push(JSON.parse(alertData));
                }
            }

            return alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        } catch (error) {
            this.loggingService.logError('Failed to get alert history', error);
            return [];
        }
    }

    private generateAlertMessage(rule: AlertRule, data: Record<string, any>): string {
        switch (rule.id) {
            case 'high_error_rate':
                return `Error rate is ${(data.errorRate * 100).toFixed(2)}%, exceeding the 10% threshold.`;
            case 'high_response_time':
                return `Average response time is ${data.avgResponseTime}ms, exceeding the 5000ms threshold.`;
            case 'high_memory_usage':
                return `Memory usage is ${(data.memoryUsage * 100).toFixed(2)}%, exceeding the 80% threshold.`;
            case 'database_down':
                return 'Database connection has failed. Please check database status.';
            case 'redis_down':
                return 'Redis connection has failed. Please check Redis status.';
            case 'security_breach':
                return `${data.securityEvents} security events detected in the monitoring window.`;
            case 'payment_failure':
                return `${data.paymentFailures} payment failures detected.`;
            case 'rate_limit_exceeded':
                return `${data.rateLimitExceeded} rate limit violations detected.`;
            default:
                return `Alert condition met for ${rule.name}.`;
        }
    }

    private async storeAlert(alert: Alert): Promise<void> {
        try {
            const key = `alert:${alert.id}`;
            await this.redisService.set(key, JSON.stringify(alert), 86400 * 7); // 7 days TTL
        } catch (error) {
            this.loggingService.logError('Failed to store alert', error);
        }
    }

    private async getAlert(alertId: string): Promise<Alert | null> {
        try {
            const key = `alert:${alertId}`;
            const alertData = await this.redisService.get(key);
            return alertData ? JSON.parse(alertData) : null;
        } catch (error) {
            this.loggingService.logError('Failed to get alert', error);
            return null;
        }
    }

    private async sendAlert(alert: Alert): Promise<void> {
        for (const [channelId, channel] of this.alertChannels) {
            if (!channel.enabled) continue;

            try {
                switch (channel.type) {
                    case 'email':
                        await this.sendEmailAlert(alert, channel.config);
                        break;
                    case 'webhook':
                        await this.sendWebhookAlert(alert, channel.config);
                        break;
                    default:
                        this.loggingService.logWarning(`Unknown alert channel type: ${channel.type}`);
                }
            } catch (error) {
                this.loggingService.logError(`Failed to send alert via ${channel.type}`, error, {
                    channelId,
                    alertId: alert.id,
                });
            }
        }
    }

    private async sendEmailAlert(alert: Alert, config: Record<string, any>): Promise<void> {
        if (!this.emailService) {
            this.loggingService.logWarning('Email service not available for alerts');
            return;
        }

        const subject = `[${alert.severity.toUpperCase()}] ${alert.title}`;
        const body = `
Alert Details:
- Title: ${alert.title}
- Severity: ${alert.severity}
- Time: ${alert.timestamp.toISOString()}
- Message: ${alert.message}

Additional Data:
${JSON.stringify(alert.data, null, 2)}

Please investigate this issue immediately.
        `;

        await this.emailService.sendAlertEmail(config.to, {
            title: subject,
            body,
            severity: alert.severity,
        });
    }

    private async sendWebhookAlert(alert: Alert, config: Record<string, any>): Promise<void> {
        // For MVP, we'll just log the webhook alert
        // In production, this would make an HTTP request to the webhook URL
        this.loggingService.logInfo('Webhook alert would be sent', {
            url: config.url,
            alertId: alert.id,
            severity: alert.severity,
        });
    }
}
