import { Injectable } from '@nestjs/common';
import { LoggingService } from './logging.service';
import { EmailService } from '../../jobs/services/email.service';
import { monitoringConfig } from '../../../config';

export interface Alert {
    id: string;
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    title: string;
    message: string;
    data: Record<string, any>;
    timestamp: Date;
    resolved: boolean;
    resolvedAt?: Date;
    channels: string[];
}

export interface AlertRule {
    id: string;
    name: string;
    condition: string;
    threshold: number;
    window: number; // Time window in milliseconds
    severity: 'low' | 'medium' | 'high' | 'critical';
    channels: string[];
    enabled: boolean;
    cooldown: number; // Cooldown period in milliseconds
}

@Injectable()
export class AlertingService {
    private readonly config = monitoringConfig();

    private alerts: Map<string, Alert> = new Map();
    private alertRules: Map<string, AlertRule> = new Map();
    private lastAlertTimes: Map<string, Date> = new Map();

    constructor(
        private readonly loggingService: LoggingService,
        private readonly emailService?: EmailService, // Optional dependency
    ) {
        this.initializeDefaultRules();
        this.startAlertCleanup();
    }

    private initializeDefaultRules() {
        // High error rate rule
        this.addAlertRule({
            id: 'high_error_rate',
            name: 'High Error Rate',
            condition: 'error_rate',
            threshold: 10, // 10 errors per minute
            window: 300000, // 5 minutes
            severity: 'high',
            channels: ['email', 'log'],
            enabled: true,
            cooldown: 900000, // 15 minutes
        });

        // High memory usage rule
        this.addAlertRule({
            id: 'high_memory_usage',
            name: 'High Memory Usage',
            condition: 'memory_usage_percent',
            threshold: 90,
            window: 300000, // 5 minutes
            severity: 'medium',
            channels: ['email', 'log'],
            enabled: true,
            cooldown: 1800000, // 30 minutes
        });

        // Database connection failure
        this.addAlertRule({
            id: 'database_connection_failure',
            name: 'Database Connection Failure',
            condition: 'database_health',
            threshold: 1,
            window: 60000, // 1 minute
            severity: 'critical',
            channels: ['email', 'slack', 'log'],
            enabled: true,
            cooldown: 300000, // 5 minutes
        });

        // Payment failures
        this.addAlertRule({
            id: 'payment_failure_spike',
            name: 'Payment Failure Spike',
            condition: 'payment_failure_rate',
            threshold: 5, // 5 failed payments in window
            window: 600000, // 10 minutes
            severity: 'high',
            channels: ['email', 'slack'],
            enabled: true,
            cooldown: 600000, // 10 minutes
        });

        // Payment processing delays
        this.addAlertRule({
            id: 'payment_processing_delay',
            name: 'Payment Processing Delay',
            condition: 'payment_processing_time',
            threshold: 30000, // 30 seconds
            window: 300000, // 5 minutes
            severity: 'medium',
            channels: ['email'],
            enabled: true,
            cooldown: 1800000, // 30 minutes
        });

        // High refund rate
        this.addAlertRule({
            id: 'high_refund_rate',
            name: 'High Refund Rate',
            condition: 'refund_rate',
            threshold: 10, // 10% refund rate
            window: 3600000, // 1 hour
            severity: 'high',
            channels: ['email', 'slack'],
            enabled: true,
            cooldown: 1800000, // 30 minutes
        });

        // Payment gateway connectivity
        this.addAlertRule({
            id: 'payment_gateway_down',
            name: 'Payment Gateway Down',
            condition: 'gateway_connectivity',
            threshold: 1, // Any failure
            window: 60000, // 1 minute
            severity: 'critical',
            channels: ['email', 'slack', 'phone'],
            enabled: true,
            cooldown: 300000, // 5 minutes
        });

        // Queue job failures
        this.addAlertRule({
            id: 'queue_job_failures',
            name: 'Queue Job Failures',
            condition: 'failed_jobs',
            threshold: 10,
            window: 300000, // 5 minutes
            severity: 'medium',
            channels: ['email', 'log'],
            enabled: true,
            cooldown: 900000, // 15 minutes
        });
    }

    addAlertRule(rule: AlertRule) {
        this.alertRules.set(rule.id, rule);
        this.loggingService.logInfo(`Alert rule added: ${rule.name}`, {
            ruleId: rule.id,
            severity: rule.severity,
            threshold: rule.threshold,
        });
    }

    removeAlertRule(ruleId: string): boolean {
        const removed = this.alertRules.delete(ruleId);
        if (removed) {
            this.loggingService.logInfo(`Alert rule removed: ${ruleId}`);
        }
        return removed;
    }

    async sendAlert(type: string, data: Record<string, any>): Promise<void> {
        const rule = this.alertRules.get(type);
        if (!rule || !rule.enabled) {
            return;
        }

        // Check cooldown
        const lastAlert = this.lastAlertTimes.get(type);
        if (lastAlert && Date.now() - lastAlert.getTime() < rule.cooldown) {
            return; // Still in cooldown period
        }

        const alert: Alert = {
            id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type,
            severity: rule.severity,
            title: rule.name,
            message: this.formatAlertMessage(type, data),
            data,
            timestamp: new Date(),
            resolved: false,
            channels: rule.channels,
        };

        this.alerts.set(alert.id, alert);
        this.lastAlertTimes.set(type, new Date());

        // Send alert to configured channels
        await this.sendToChannels(alert);

        this.loggingService.logWarning(`Alert triggered: ${alert.title}`, {
            alertId: alert.id,
            type: alert.type,
            severity: alert.severity,
            data: alert.data,
        });
    }

    async sendCustomAlert(
        title: string,
        message: string,
        severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
        channels: string[] = ['log'],
    ): Promise<void> {
        const alert: Alert = {
            id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: 'custom',
            severity,
            title,
            message,
            data: {},
            timestamp: new Date(),
            resolved: false,
            channels,
        };

        this.alerts.set(alert.id, alert);
        await this.sendToChannels(alert);

        this.loggingService.logInfo(`Custom alert sent: ${title}`, {
            alertId: alert.id,
            severity,
        });
    }

    resolveAlert(alertId: string): boolean {
        const alert = this.alerts.get(alertId);
        if (alert && !alert.resolved) {
            alert.resolved = true;
            alert.resolvedAt = new Date();

            this.loggingService.logInfo(`Alert resolved: ${alert.title}`, {
                alertId,
                duration: alert.resolvedAt.getTime() - alert.timestamp.getTime(),
            });

            return true;
        }
        return false;
    }

    getActiveAlerts(): Alert[] {
        return Array.from(this.alerts.values())
            .filter(alert => !alert.resolved)
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }

    getAlertHistory(limit: number = 100): Alert[] {
        return Array.from(this.alerts.values())
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
            .slice(0, limit);
    }

    getAlertById(alertId: string): Alert | null {
        return this.alerts.get(alertId) || null;
    }

    getAlertRules(): AlertRule[] {
        return Array.from(this.alertRules.values());
    }

    updateAlertRule(ruleId: string, updates: Partial<AlertRule>): boolean {
        const rule = this.alertRules.get(ruleId);
        if (rule) {
            Object.assign(rule, updates);
            this.loggingService.logInfo(`Alert rule updated: ${ruleId}`, updates);
            return true;
        }
        return false;
    }

    // Method to check conditions and trigger alerts (called by monitoring services)
    checkCondition(condition: string, value: number, metadata: Record<string, any> = {}) {
        const rule = Array.from(this.alertRules.values()).find(
            r => r.condition === condition && r.enabled,
        );

        if (!rule) return;

        if (value >= rule.threshold) {
            this.sendAlert(rule.id, {
                condition,
                value,
                threshold: rule.threshold,
                ...metadata,
            });
        }
    }

    private async sendToChannels(alert: Alert) {
        for (const channel of alert.channels) {
            try {
                await this.sendToChannel(channel, alert);
            } catch (error) {
                this.loggingService.logError(`Failed to send alert to ${channel}`, {
                    error,
                });
            }
        }
    }

    private async sendToChannel(channel: string, alert: Alert) {
        switch (channel) {
            case 'email':
                await this.sendEmailAlert(alert);
                break;

            case 'slack':
                await this.sendSlackAlert(alert);
                break;

            case 'discord':
                await this.sendDiscordAlert(alert);
                break;

            case 'webhook':
                await this.sendWebhookAlert(alert);
                break;

            case 'log':
                this.logAlert(alert);
                break;

            default:
                this.loggingService.logWarning(`Unknown alert channel: ${channel}`);
        }
    }

    private async sendEmailAlert(alert: Alert) {
        if (!this.emailService) {
            this.loggingService.logWarning('Email service not available for alerts');
            return;
        }

        const recipients = this.config.notifications.errorEmail;
        if (recipients.length === 0) {
            this.loggingService.logWarning('No email recipients configured for alerts');
            return;
        }

        for (const recipient of recipients) {
            await this.emailService.sendEmail(
                recipient,
                `🚨 Alert: ${alert.title}`,
                this.generateEmailAlertHtml(alert),
                this.generateEmailAlertText(alert),
            );
        }
    }

    private async sendSlackAlert(alert: Alert) {
        const webhookUrl = this.config.notifications.slackWebhook;
        if (!webhookUrl) {
            this.loggingService.logWarning('Slack webhook URL not configured');
            return;
        }

        const payload = {
            text: `🚨 Alert: ${alert.title}`,
            attachments: [
                {
                    color: this.getSeverityColor(alert.severity),
                    fields: [
                        { title: 'Severity', value: alert.severity.toUpperCase(), short: true },
                        { title: 'Time', value: alert.timestamp.toISOString(), short: true },
                        { title: 'Message', value: alert.message, short: false },
                    ],
                },
            ],
        };

        const fetch = require('node-fetch');
        await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    }

    private async sendDiscordAlert(alert: Alert) {
        const webhookUrl = this.config.notifications.discordWebhook;
        if (!webhookUrl) {
            this.loggingService.logWarning('Discord webhook URL not configured');
            return;
        }

        const payload = {
            embeds: [
                {
                    title: `🚨 Alert: ${alert.title}`,
                    description: alert.message,
                    color: parseInt(this.getSeverityColor(alert.severity).replace('#', ''), 16),
                    fields: [
                        { name: 'Severity', value: alert.severity.toUpperCase(), inline: true },
                        { name: 'Time', value: alert.timestamp.toISOString(), inline: true },
                    ],
                    timestamp: alert.timestamp.toISOString(),
                },
            ],
        };

        const fetch = require('node-fetch');
        await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    }

    private async sendWebhookAlert(alert: Alert) {
        const webhookUrl = this.config.notifications.criticalErrorWebhook;
        if (!webhookUrl) return;

        const fetch = require('node-fetch');
        await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(alert),
        });
    }

    private logAlert(alert: Alert) {
        const logMethod = alert.severity === 'critical' ? 'logError' : 'logWarning';
        this.loggingService[logMethod](`ALERT: ${alert.title}`, {
            error: new Error(alert.message),
            alertId: alert.id,
            severity: alert.severity,
            message: alert.message,
            data: alert.data,
        });
    }

    private formatAlertMessage(type: string, data: Record<string, any>): string {
        switch (type) {
            case 'high_error_rate':
                return `Error rate is ${data.value}/min (threshold: ${data.threshold}/min)`;

            case 'high_memory_usage':
                return `Memory usage is ${data.value}% (threshold: ${data.threshold}%)`;

            case 'database_connection_failure':
                return `Database connection failed: ${data.error || 'Unknown error'}`;

            case 'payment_failure_spike':
                return `${data.value} payment failures in the last 10 minutes (threshold: ${data.threshold})`;

            case 'critical_error':
                return `Critical error occurred: ${data.message}`;

            case 'high_frequency_error':
                return `High frequency error: ${data.message} (${data.frequency} errors/min)`;

            default:
                return `Alert condition met: ${type}`;
        }
    }

    private generateEmailAlertHtml(alert: Alert): string {
        return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: ${this.getSeverityColor(alert.severity)}; color: white; padding: 20px; text-align: center;">
          <h1>🚨 ${alert.title}</h1>
          <p style="margin: 0; font-size: 18px;">Severity: ${alert.severity.toUpperCase()}</p>
        </div>
        
        <div style="padding: 20px; background: #f8f9fa;">
          <h2>Alert Details</h2>
          <p><strong>Time:</strong> ${alert.timestamp.toISOString()}</p>
          <p><strong>Message:</strong> ${alert.message}</p>
          
          ${
              Object.keys(alert.data).length > 0
                  ? `
            <h3>Additional Data</h3>
            <pre style="background: #e9ecef; padding: 10px; border-radius: 4px;">${JSON.stringify(alert.data, null, 2)}</pre>
          `
                  : ''
          }
        </div>
        
        <div style="padding: 20px; text-align: center; background: #e9ecef;">
          <p>This alert was generated by Genie AI Monitoring System</p>
          <p>Alert ID: ${alert.id}</p>
        </div>
      </div>
    `;
    }

    private generateEmailAlertText(alert: Alert): string {
        return `
🚨 ALERT: ${alert.title}

Severity: ${alert.severity.toUpperCase()}
Time: ${alert.timestamp.toISOString()}
Message: ${alert.message}

${
    Object.keys(alert.data).length > 0
        ? `
Additional Data:
${JSON.stringify(alert.data, null, 2)}
`
        : ''
}

Alert ID: ${alert.id}
Generated by Genie AI Monitoring System
    `.trim();
    }

    private getSeverityColor(severity: string): string {
        switch (severity) {
            case 'critical':
                return '#dc3545';
            case 'high':
                return '#fd7e14';
            case 'medium':
                return '#ffc107';
            case 'low':
                return '#28a745';
            default:
                return '#6c757d';
        }
    }

    private startAlertCleanup() {
        // Clean old resolved alerts every 24 hours
        setInterval(
            () => {
                const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days

                let cleaned = 0;
                for (const [alertId, alert] of this.alerts.entries()) {
                    if (alert.resolved && alert.resolvedAt && alert.resolvedAt < cutoff) {
                        this.alerts.delete(alertId);
                        cleaned++;
                    }
                }

                if (cleaned > 0) {
                    this.loggingService.logInfo(`Cleaned ${cleaned} old resolved alerts`);
                }
            },
            24 * 60 * 60 * 1000,
        );
    }
}
