import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
import { LoggingService } from './logging.service';
import { BusinessAnalyticsService, BusinessInsight } from './business-analytics.service';
import { CostMonitoringService, CostAlert } from './cost-monitoring.service';

export interface BusinessAlertRule {
  id: string;
  name: string;
  description: string;
  metric: string;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'ne' | 'contains' | 'not_contains';
  threshold: number | string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  cooldownMinutes: number;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export interface BusinessAlert {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  metric: string;
  value: number | string;
  threshold: number | string;
  timestamp: number;
  acknowledged: boolean;
  resolved: boolean;
  resolvedAt?: number;
  metadata?: Record<string, any>;
  tags: string[];
}

export interface BusinessAlertStats {
  total: number;
  bySeverity: Record<string, number>;
  byRule: Record<string, number>;
  acknowledged: number;
  resolved: number;
  active: number;
  recent: BusinessAlert[];
}

export interface BusinessAlertConfig {
  emailNotifications: boolean;
  webhookNotifications: boolean;
  webhookUrl?: string;
  emailRecipients: string[];
  alertChannels: {
    slack?: string;
    discord?: string;
    teams?: string;
  };
  globalCooldownMinutes: number;
  maxAlertsPerHour: number;
}

@Injectable()
export class BusinessAlertsService {
  private readonly logger = new Logger(BusinessAlertsService.name);
  private readonly rules = new Map<string, BusinessAlertRule>();
  private readonly alerts: BusinessAlert[] = [];
  private readonly alertHistory: Map<string, number> = new Map(); // ruleId -> lastAlertTime
  private readonly maxAlerts = 10000;
  private readonly config: BusinessAlertConfig = {
    emailNotifications: true,
    webhookNotifications: false,
    emailRecipients: [],
    alertChannels: {},
    globalCooldownMinutes: 5,
    maxAlertsPerHour: 100,
  };

  constructor(
    private readonly redisService: RedisService,
    private readonly loggingService: LoggingService,
    private readonly businessAnalyticsService: BusinessAnalyticsService,
    private readonly costMonitoringService: CostMonitoringService,
  ) {
    this.initializeDefaultRules();
  }

  /**
   * Create a new business alert rule
   */
  createRule(rule: Omit<BusinessAlertRule, 'id' | 'createdAt' | 'updatedAt'>): string {
    const id = this.generateId();
    const now = Date.now();
    
    const newRule: BusinessAlertRule = {
      ...rule,
      id,
      createdAt: now,
      updatedAt: now,
    };

    this.rules.set(id, newRule);

    this.loggingService.log(
      `Business alert rule created: ${rule.name}`,
      'monitoring',
    );

    return id;
  }

  /**
   * Update a business alert rule
   */
  updateRule(ruleId: string, updates: Partial<BusinessAlertRule>): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      this.logger.warn(`Rule ${ruleId} not found`);
      return false;
    }

    const updatedRule = { ...rule, ...updates, updatedAt: Date.now() };
    this.rules.set(ruleId, updatedRule);

    this.loggingService.log(
      `Business alert rule updated: ${rule.name}`,
      'monitoring',
    );

    return true;
  }

  /**
   * Delete a business alert rule
   */
  deleteRule(ruleId: string): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      this.logger.warn(`Rule ${ruleId} not found`);
      return false;
    }

    this.rules.delete(ruleId);
    this.alertHistory.delete(ruleId);

    this.loggingService.log(
      `Business alert rule deleted: ${rule.name}`,
      'monitoring',
    );

    return true;
  }

  /**
   * Get all business alert rules
   */
  getRules(): BusinessAlertRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Get a specific business alert rule
   */
  getRule(ruleId: string): BusinessAlertRule | null {
    return this.rules.get(ruleId) || null;
  }

  /**
   * Evaluate all business alert rules
   */
  async evaluateRules(): Promise<BusinessAlert[]> {
    const newAlerts: BusinessAlert[] = [];
    const enabledRules = Array.from(this.rules.values()).filter(rule => rule.enabled);

    this.logger.debug(`Evaluating ${enabledRules.length} business alert rules`);

    for (const rule of enabledRules) {
      try {
        const alert = await this.evaluateRule(rule);
        if (alert) {
          newAlerts.push(alert);
        }
      } catch (error) {
        this.logger.error(`Failed to evaluate rule ${rule.id}: ${error.message}`);
      }
    }

    // Store new alerts
    this.alerts.push(...newAlerts);
    if (this.alerts.length > this.maxAlerts) {
      this.alerts.splice(0, this.alerts.length - this.maxAlerts);
    }

    // Send notifications for new alerts
    for (const alert of newAlerts) {
      await this.sendAlertNotification(alert);
    }

    this.logger.log(`Generated ${newAlerts.length} new business alerts`);
    return newAlerts;
  }

  /**
   * Get business alerts
   */
  getAlerts(
    ruleId?: string,
    severity?: string,
    resolved?: boolean,
    acknowledged?: boolean,
    limit = 100,
  ): BusinessAlert[] {
    let filteredAlerts = this.alerts;

    if (ruleId) {
      filteredAlerts = filteredAlerts.filter(alert => alert.ruleId === ruleId);
    }
    if (severity) {
      filteredAlerts = filteredAlerts.filter(alert => alert.severity === severity);
    }
    if (resolved !== undefined) {
      filteredAlerts = filteredAlerts.filter(alert => alert.resolved === resolved);
    }
    if (acknowledged !== undefined) {
      filteredAlerts = filteredAlerts.filter(alert => alert.acknowledged === acknowledged);
    }

    return filteredAlerts.slice(-limit);
  }

  /**
   * Get business alert statistics
   */
  getAlertStats(): BusinessAlertStats {
    const bySeverity = this.groupBy(this.alerts, 'severity');
    const byRule = this.groupBy(this.alerts, 'ruleName');
    const acknowledged = this.alerts.filter(alert => alert.acknowledged).length;
    const resolved = this.alerts.filter(alert => alert.resolved).length;
    const active = this.alerts.filter(alert => !alert.resolved).length;

    return {
      total: this.alerts.length,
      bySeverity: this.countBy(bySeverity),
      byRule: this.countBy(byRule),
      acknowledged,
      resolved,
      active,
      recent: this.alerts.slice(-10),
    };
  }

  /**
   * Acknowledge a business alert
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (!alert) {
      this.logger.warn(`Alert ${alertId} not found`);
      return false;
    }

    alert.acknowledged = true;

    this.loggingService.log(
      `Business alert acknowledged: ${alert.message}`,
      'monitoring',
    );

    return true;
  }

  /**
   * Resolve a business alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (!alert) {
      this.logger.warn(`Alert ${alertId} not found`);
      return false;
    }

    alert.resolved = true;
    alert.resolvedAt = Date.now();

    this.loggingService.log(
      `Business alert resolved: ${alert.message}`,
      'monitoring',
    );

    return true;
  }

  /**
   * Update alert configuration
   */
  updateConfig(config: Partial<BusinessAlertConfig>): void {
    Object.assign(this.config, config);

    this.loggingService.log(
      'Business alert configuration updated',
      'monitoring',
    );
  }

  /**
   * Get alert configuration
   */
  getConfig(): BusinessAlertConfig {
    return { ...this.config };
  }

  /**
   * Clear old alerts
   */
  clearOldAlerts(olderThanDays = 30): void {
    const cutoff = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
    const oldCount = this.alerts.length;
    
    this.alerts.splice(
      0,
      this.alerts.findIndex(alert => alert.timestamp >= cutoff)
    );

    this.logger.log(`Cleared ${oldCount - this.alerts.length} old business alerts`);
  }

  private async evaluateRule(rule: BusinessAlertRule): Promise<BusinessAlert | null> {
    // Check cooldown
    const lastAlertTime = this.alertHistory.get(rule.id);
    if (lastAlertTime) {
      const cooldownMs = rule.cooldownMinutes * 60 * 1000;
      if (Date.now() - lastAlertTime < cooldownMs) {
        return null;
      }
    }

    // Get metric value
    const value = await this.getMetricValue(rule.metric);
    if (value === null) {
      this.logger.warn(`Could not get value for metric: ${rule.metric}`);
      return null;
    }

    // Evaluate condition
    const conditionMet = this.evaluateCondition(value, rule.operator, rule.threshold);
    if (!conditionMet) {
      return null;
    }

    // Create alert
    const alert: BusinessAlert = {
      id: this.generateId(),
      ruleId: rule.id,
      ruleName: rule.name,
      severity: rule.severity,
      message: this.generateAlertMessage(rule, value),
      metric: rule.metric,
      value,
      threshold: rule.threshold,
      timestamp: Date.now(),
      acknowledged: false,
      resolved: false,
      metadata: {
        ruleDescription: rule.description,
        tags: rule.tags,
      },
      tags: rule.tags,
    };

    // Update alert history
    this.alertHistory.set(rule.id, Date.now());

    return alert;
  }

  private async getMetricValue(metric: string): Promise<number | string | null> {
    try {
      switch (metric) {
        case 'revenue.daily':
          const dailyMetrics = await this.businessAnalyticsService.getBusinessMetrics();
          return dailyMetrics.revenue.daily;

        case 'revenue.monthly':
          const monthlyMetrics = await this.businessAnalyticsService.getBusinessMetrics();
          return monthlyMetrics.revenue.monthly;

        case 'users.active':
          const userMetrics = await this.businessAnalyticsService.getBusinessMetrics();
          return userMetrics.users.active;

        case 'users.new':
          const newUserMetrics = await this.businessAnalyticsService.getBusinessMetrics();
          return newUserMetrics.users.new;

        case 'conversion.overall':
          const conversionMetrics = await this.businessAnalyticsService.getBusinessMetrics();
          return conversionMetrics.conversion.overall;

        case 'ai.requests.total':
          const aiMetrics = await this.businessAnalyticsService.getBusinessMetrics();
          return aiMetrics.ai.totalRequests;

        case 'credits.utilization_rate':
          const creditMetrics = await this.businessAnalyticsService.getBusinessMetrics();
          return creditMetrics.credits.utilizationRate;

        case 'cost.total.daily':
          const costMetrics = this.costMonitoringService.getCostMetrics('day');
          return costMetrics.total.cost;

        case 'cost.total.monthly':
          const monthlyCostMetrics = this.costMonitoringService.getCostMetrics('month');
          return monthlyCostMetrics.total.cost;

        case 'error_rate':
          // This would need to be implemented based on error tracking
          return 0;

        case 'response_time.avg':
          // This would need to be implemented based on performance tracking
          return 0;

        default:
          this.logger.warn(`Unknown metric: ${metric}`);
          return null;
      }
    } catch (error) {
      this.logger.error(`Failed to get metric value for ${metric}: ${error.message}`);
      return null;
    }
  }

  private evaluateCondition(value: number | string, operator: string, threshold: number | string): boolean {
    if (typeof value === 'number' && typeof threshold === 'number') {
      switch (operator) {
        case 'gt': return value > threshold;
        case 'lt': return value < threshold;
        case 'eq': return value === threshold;
        case 'gte': return value >= threshold;
        case 'lte': return value <= threshold;
        case 'ne': return value !== threshold;
        default: return false;
      }
    } else if (typeof value === 'string' && typeof threshold === 'string') {
      switch (operator) {
        case 'eq': return value === threshold;
        case 'ne': return value !== threshold;
        case 'contains': return value.includes(threshold);
        case 'not_contains': return !value.includes(threshold);
        default: return false;
      }
    }
    return false;
  }

  private generateAlertMessage(rule: BusinessAlertRule, value: number | string): string {
    const threshold = rule.threshold;
    const operator = rule.operator;
    
    let operatorText: string;
    switch (operator) {
      case 'gt': operatorText = 'greater than'; break;
      case 'lt': operatorText = 'less than'; break;
      case 'eq': operatorText = 'equal to'; break;
      case 'gte': operatorText = 'greater than or equal to'; break;
      case 'lte': operatorText = 'less than or equal to'; break;
      case 'ne': operatorText = 'not equal to'; break;
      case 'contains': operatorText = 'contains'; break;
      case 'not_contains': operatorText = 'does not contain'; break;
      default: operatorText = operator;
    }

    return `${rule.name}: ${rule.metric} (${value}) is ${operatorText} ${threshold}`;
  }

  private async sendAlertNotification(alert: BusinessAlert): Promise<void> {
    try {
      // Email notification
      if (this.config.emailNotifications && this.config.emailRecipients.length > 0) {
        await this.sendEmailNotification(alert);
      }

      // Webhook notification
      if (this.config.webhookNotifications && this.config.webhookUrl) {
        await this.sendWebhookNotification(alert);
      }

      // Slack notification
      if (this.config.alertChannels.slack) {
        await this.sendSlackNotification(alert);
      }

      this.loggingService.log(
        `Alert notification sent: ${alert.message}`,
        'monitoring',
      );
    } catch (error) {
      this.logger.error(`Failed to send alert notification: ${error.message}`);
    }
  }

  private async sendEmailNotification(alert: BusinessAlert): Promise<void> {
    // This would integrate with your email service
    this.logger.log(`Email notification sent for alert: ${alert.id}`);
  }

  private async sendWebhookNotification(alert: BusinessAlert): Promise<void> {
    // This would send a webhook notification
    this.logger.log(`Webhook notification sent for alert: ${alert.id}`);
  }

  private async sendSlackNotification(alert: BusinessAlert): Promise<void> {
    // This would send a Slack notification
    this.logger.log(`Slack notification sent for alert: ${alert.id}`);
  }

  private initializeDefaultRules(): void {
    const defaultRules: Omit<BusinessAlertRule, 'id' | 'createdAt' | 'updatedAt'>[] = [
      {
        name: 'High Revenue Growth',
        description: 'Alert when daily revenue growth exceeds 50%',
        metric: 'revenue.growth.day',
        operator: 'gt',
        threshold: 50,
        severity: 'high',
        enabled: true,
        cooldownMinutes: 60,
        tags: ['revenue', 'growth'],
      },
      {
        name: 'Low Conversion Rate',
        description: 'Alert when overall conversion rate drops below 2%',
        metric: 'conversion.overall',
        operator: 'lt',
        threshold: 0.02,
        severity: 'medium',
        enabled: true,
        cooldownMinutes: 30,
        tags: ['conversion', 'revenue'],
      },
      {
        name: 'High Error Rate',
        description: 'Alert when error rate exceeds 5%',
        metric: 'error_rate',
        operator: 'gt',
        threshold: 5,
        severity: 'critical',
        enabled: true,
        cooldownMinutes: 15,
        tags: ['errors', 'performance'],
      },
      {
        name: 'High Cost Alert',
        description: 'Alert when daily costs exceed $1000',
        metric: 'cost.total.daily',
        operator: 'gt',
        threshold: 1000,
        severity: 'high',
        enabled: true,
        cooldownMinutes: 60,
        tags: ['cost', 'budget'],
      },
      {
        name: 'Low Active Users',
        description: 'Alert when daily active users drop below 10',
        metric: 'users.active',
        operator: 'lt',
        threshold: 10,
        severity: 'medium',
        enabled: true,
        cooldownMinutes: 30,
        tags: ['users', 'engagement'],
      },
    ];

    for (const rule of defaultRules) {
      this.createRule(rule);
    }
  }

  private groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
    return array.reduce((groups, item) => {
      const group = String(item[key]);
      groups[group] = groups[group] || [];
      groups[group].push(item);
      return groups;
    }, {} as Record<string, T[]>);
  }

  private countBy<T>(groups: Record<string, T[]>): Record<string, number> {
    return Object.keys(groups).reduce((counts, key) => {
      counts[key] = groups[key].length;
      return counts;
    }, {} as Record<string, number>);
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
