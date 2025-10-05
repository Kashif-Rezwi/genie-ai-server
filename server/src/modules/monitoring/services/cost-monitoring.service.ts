import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
import { LoggingService } from './logging.service';

export interface CostCategory {
  id: string;
  name: string;
  description: string;
  unit: 'requests' | 'tokens' | 'storage' | 'compute' | 'bandwidth' | 'api_calls';
  costPerUnit: number;
  currency: string;
  enabled: boolean;
}

export interface CostRecord {
  id: string;
  categoryId: string;
  userId?: string;
  amount: number;
  units: number;
  cost: number;
  currency: string;
  timestamp: number;
  metadata?: Record<string, any>;
  tags?: Record<string, string>;
}

export interface CostMetrics {
  total: {
    cost: number;
    units: number;
    currency: string;
  };
  byCategory: Record<
    string,
    {
      cost: number;
      units: number;
      percentage: number;
    }
  >;
  byUser: Record<
    string,
    {
      cost: number;
      units: number;
      percentage: number;
    }
  >;
  trends: {
    daily: CostTrend[];
    weekly: CostTrend[];
    monthly: CostTrend[];
  };
  projections: {
    daily: number;
    weekly: number;
    monthly: number;
    yearly: number;
  };
  alerts: CostAlert[];
}

export interface CostTrend {
  period: string;
  cost: number;
  units: number;
  change: number;
  changePercent: number;
}

export interface CostAlert {
  id: string;
  type: 'budget_exceeded' | 'unusual_spike' | 'category_threshold' | 'user_threshold';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  categoryId?: string;
  userId?: string;
  threshold: number;
  actual: number;
  timestamp: number;
  acknowledged: boolean;
  resolved: boolean;
}

export interface CostBudget {
  id: string;
  name: string;
  categoryId?: string;
  userId?: string;
  amount: number;
  currency: string;
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
  alertThreshold: number; // percentage (0-100)
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

@Injectable()
export class CostMonitoringService {
  private readonly logger = new Logger(CostMonitoringService.name);
  private readonly categories = new Map<string, CostCategory>();
  private readonly records: CostRecord[] = [];
  private readonly budgets = new Map<string, CostBudget>();
  private readonly alerts: CostAlert[] = [];
  private readonly maxRecords = 100000;
  private readonly maxAlerts = 1000;

  constructor(
    private readonly redisService: RedisService,
    private readonly loggingService: LoggingService
  ) {
    this.initializeDefaultCategories();
  }

  /**
   * Create a new cost category
   */
  createCategory(category: Omit<CostCategory, 'id'>): string {
    const id = this.generateId();
    const newCategory: CostCategory = {
      ...category,
      id,
    };

    this.categories.set(id, newCategory);

    this.loggingService.log(`Cost category created: ${category.name}`, 'monitoring');

    return id;
  }

  /**
   * Update a cost category
   */
  updateCategory(categoryId: string, updates: Partial<CostCategory>): boolean {
    const category = this.categories.get(categoryId);
    if (!category) {
      this.logger.warn(`Category ${categoryId} not found`);
      return false;
    }

    const updatedCategory = { ...category, ...updates };
    this.categories.set(categoryId, updatedCategory);

    this.loggingService.log(`Cost category updated: ${category.name}`, 'monitoring');

    return true;
  }

  /**
   * Get all cost categories
   */
  getCategories(): CostCategory[] {
    return Array.from(this.categories.values());
  }

  /**
   * Get a specific cost category
   */
  getCategory(categoryId: string): CostCategory | null {
    return this.categories.get(categoryId) || null;
  }

  /**
   * Record a cost
   */
  recordCost(
    categoryId: string,
    units: number,
    userId?: string,
    metadata?: Record<string, any>,
    tags?: Record<string, string>
  ): string {
    const category = this.categories.get(categoryId);
    if (!category) {
      throw new Error(`Category ${categoryId} not found`);
    }

    if (!category.enabled) {
      this.logger.warn(`Category ${categoryId} is disabled`);
      return '';
    }

    const cost = units * category.costPerUnit;
    const recordId = this.generateId();

    const record: CostRecord = {
      id: recordId,
      categoryId,
      userId,
      amount: cost,
      units,
      cost,
      currency: category.currency,
      timestamp: Date.now(),
      metadata,
      tags,
    };

    this.records.push(record);

    // Cleanup old records
    if (this.records.length > this.maxRecords) {
      this.records.splice(0, this.records.length - this.maxRecords);
    }

    // Check for budget alerts
    this.checkBudgetAlerts(record);

    this.loggingService.log(
      `Cost recorded: ${category.name} - ${units} ${category.unit} = ${cost} ${category.currency}`,
      'monitoring'
    );

    return recordId;
  }

  /**
   * Get cost metrics
   */
  getCostMetrics(period: 'day' | 'week' | 'month' | 'year' = 'month'): CostMetrics {
    const now = Date.now();
    const periodStart = this.getPeriodStart(now, period);
    const periodRecords = this.records.filter(record => record.timestamp >= periodStart);

    // Calculate total costs
    const totalCost = periodRecords.reduce((sum, record) => sum + record.cost, 0);
    const totalUnits = periodRecords.reduce((sum, record) => sum + record.units, 0);
    const currency = periodRecords[0]?.currency || 'USD';

    // Calculate costs by category
    const costsByCategory = this.groupBy(periodRecords, 'categoryId');
    const byCategory: Record<string, { cost: number; units: number; percentage: number }> = {};

    for (const [categoryId, records] of Object.entries(costsByCategory)) {
      const categoryCost = records.reduce((sum, record) => sum + record.cost, 0);
      const categoryUnits = records.reduce((sum, record) => sum + record.units, 0);
      byCategory[categoryId] = {
        cost: categoryCost,
        units: categoryUnits,
        percentage: totalCost > 0 ? (categoryCost / totalCost) * 100 : 0,
      };
    }

    // Calculate costs by user
    const costsByUser = this.groupBy(
      periodRecords.filter(r => r.userId),
      'userId'
    );
    const byUser: Record<string, { cost: number; units: number; percentage: number }> = {};

    for (const [userId, records] of Object.entries(costsByUser)) {
      const userCost = records.reduce((sum, record) => sum + record.cost, 0);
      const userUnits = records.reduce((sum, record) => sum + record.units, 0);
      byUser[userId] = {
        cost: userCost,
        units: userUnits,
        percentage: totalCost > 0 ? (userCost / totalCost) * 100 : 0,
      };
    }

    // Calculate trends
    const trends = {
      daily: this.calculateTrends(periodRecords, 'day'),
      weekly: this.calculateTrends(periodRecords, 'week'),
      monthly: this.calculateTrends(periodRecords, 'month'),
    };

    // Calculate projections
    const projections = this.calculateProjections(periodRecords, period);

    // Get active alerts
    const activeAlerts = this.alerts.filter(alert => !alert.resolved);

    return {
      total: {
        cost: totalCost,
        units: totalUnits,
        currency,
      },
      byCategory,
      byUser,
      trends,
      projections,
      alerts: activeAlerts,
    };
  }

  /**
   * Create a cost budget
   */
  createBudget(budget: Omit<CostBudget, 'id' | 'createdAt' | 'updatedAt'>): string {
    const id = this.generateId();
    const now = Date.now();

    const newBudget: CostBudget = {
      ...budget,
      id,
      createdAt: now,
      updatedAt: now,
    };

    this.budgets.set(id, newBudget);

    this.loggingService.log(`Cost budget created: ${budget.name}`, 'monitoring');

    return id;
  }

  /**
   * Update a cost budget
   */
  updateBudget(budgetId: string, updates: Partial<CostBudget>): boolean {
    const budget = this.budgets.get(budgetId);
    if (!budget) {
      this.logger.warn(`Budget ${budgetId} not found`);
      return false;
    }

    const updatedBudget = { ...budget, ...updates, updatedAt: Date.now() };
    this.budgets.set(budgetId, updatedBudget);

    this.loggingService.log(`Cost budget updated: ${budget.name}`, 'monitoring');

    return true;
  }

  /**
   * Get all budgets
   */
  getBudgets(): CostBudget[] {
    return Array.from(this.budgets.values());
  }

  /**
   * Get budget by ID
   */
  getBudget(budgetId: string): CostBudget | null {
    return this.budgets.get(budgetId) || null;
  }

  /**
   * Get cost records
   */
  getRecords(
    categoryId?: string,
    userId?: string,
    startTime?: number,
    endTime?: number,
    limit = 1000
  ): CostRecord[] {
    let filteredRecords = this.records;

    if (categoryId) {
      filteredRecords = filteredRecords.filter(record => record.categoryId === categoryId);
    }
    if (userId) {
      filteredRecords = filteredRecords.filter(record => record.userId === userId);
    }
    if (startTime) {
      filteredRecords = filteredRecords.filter(record => record.timestamp >= startTime);
    }
    if (endTime) {
      filteredRecords = filteredRecords.filter(record => record.timestamp <= endTime);
    }

    return filteredRecords.slice(-limit);
  }

  /**
   * Get cost alerts
   */
  getAlerts(resolved = false, limit = 100): CostAlert[] {
    return this.alerts.filter(alert => alert.resolved === resolved).slice(-limit);
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (!alert) {
      this.logger.warn(`Alert ${alertId} not found`);
      return false;
    }

    alert.acknowledged = true;

    this.loggingService.log(`Cost alert acknowledged: ${alert.message}`, 'monitoring');

    return true;
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (!alert) {
      this.logger.warn(`Alert ${alertId} not found`);
      return false;
    }

    alert.resolved = true;

    this.loggingService.log(`Cost alert resolved: ${alert.message}`, 'monitoring');

    return true;
  }

  /**
   * Clear old records and alerts
   */
  clearOldData(olderThanDays = 90): void {
    const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;

    const oldRecordCount = this.records.length;
    this.records.splice(
      0,
      this.records.findIndex(record => record.timestamp >= cutoff)
    );

    const oldAlertCount = this.alerts.length;
    this.alerts.splice(
      0,
      this.alerts.findIndex(alert => alert.timestamp >= cutoff)
    );

    this.logger.log(
      `Cleared ${oldRecordCount - this.records.length} old cost records and ${oldAlertCount - this.alerts.length} old alerts`
    );
  }

  private initializeDefaultCategories(): void {
    const defaultCategories: Omit<CostCategory, 'id'>[] = [
      {
        name: 'AI Requests',
        description: 'Cost per AI API request',
        unit: 'requests',
        costPerUnit: 0.01,
        currency: 'USD',
        enabled: true,
      },
      {
        name: 'AI Tokens',
        description: 'Cost per AI token processed',
        unit: 'tokens',
        costPerUnit: 0.0001,
        currency: 'USD',
        enabled: true,
      },
      {
        name: 'Database Storage',
        description: 'Cost per GB of database storage',
        unit: 'storage',
        costPerUnit: 0.1,
        currency: 'USD',
        enabled: true,
      },
      {
        name: 'Compute Resources',
        description: 'Cost per hour of compute usage',
        unit: 'compute',
        costPerUnit: 0.05,
        currency: 'USD',
        enabled: true,
      },
      {
        name: 'Bandwidth',
        description: 'Cost per GB of bandwidth usage',
        unit: 'bandwidth',
        costPerUnit: 0.09,
        currency: 'USD',
        enabled: true,
      },
    ];

    for (const category of defaultCategories) {
      this.createCategory(category);
    }
  }

  private checkBudgetAlerts(record: CostRecord): void {
    const now = Date.now();
    const budgets = Array.from(this.budgets.values()).filter(budget => budget.enabled);

    for (const budget of budgets) {
      // Check if this record applies to this budget
      if (budget.categoryId && budget.categoryId !== record.categoryId) continue;
      if (budget.userId && budget.userId !== record.userId) continue;

      const periodStart = this.getPeriodStart(
        now,
        budget.period as 'day' | 'week' | 'month' | 'year'
      );
      const periodRecords = this.records.filter(
        r =>
          r.timestamp >= periodStart &&
          (!budget.categoryId || r.categoryId === budget.categoryId) &&
          (!budget.userId || r.userId === budget.userId)
      );

      const currentCost = periodRecords.reduce((sum, r) => sum + r.cost, 0);
      const threshold = budget.amount * (budget.alertThreshold / 100);

      if (currentCost >= threshold && currentCost < budget.amount) {
        this.createAlert({
          type: 'budget_exceeded',
          severity: currentCost >= budget.amount ? 'critical' : 'high',
          message: `Budget ${budget.name} is ${((currentCost / budget.amount) * 100).toFixed(1)}% used`,
          categoryId: budget.categoryId,
          userId: budget.userId,
          threshold: budget.amount,
          actual: currentCost,
        });
      }
    }
  }

  private createAlert(
    alert: Omit<CostAlert, 'id' | 'timestamp' | 'acknowledged' | 'resolved'>
  ): void {
    const alertId = this.generateId();
    const newAlert: CostAlert = {
      ...alert,
      id: alertId,
      timestamp: Date.now(),
      acknowledged: false,
      resolved: false,
    };

    this.alerts.push(newAlert);

    // Cleanup old alerts
    if (this.alerts.length > this.maxAlerts) {
      this.alerts.splice(0, this.alerts.length - this.maxAlerts);
    }

    this.loggingService.log(`Cost alert created: ${alert.message}`, 'monitoring');
  }

  private getPeriodStart(timestamp: number, period: 'day' | 'week' | 'month' | 'year'): number {
    const date = new Date(timestamp);

    switch (period) {
      case 'day':
        date.setHours(0, 0, 0, 0);
        break;
      case 'week':
        date.setDate(date.getDate() - date.getDay());
        date.setHours(0, 0, 0, 0);
        break;
      case 'month':
        date.setDate(1);
        date.setHours(0, 0, 0, 0);
        break;
      case 'year':
        date.setMonth(0, 1);
        date.setHours(0, 0, 0, 0);
        break;
    }

    return date.getTime();
  }

  private calculateTrends(records: CostRecord[], period: 'day' | 'week' | 'month'): CostTrend[] {
    const trends: CostTrend[] = [];
    const grouped = this.groupRecordsByPeriod(records, period);

    const periods = Object.keys(grouped).sort();
    for (let i = 1; i < periods.length; i++) {
      const currentPeriod = periods[i];
      const previousPeriod = periods[i - 1];

      const currentCost = grouped[currentPeriod].reduce((sum, r) => sum + r.cost, 0);
      const previousCost = grouped[previousPeriod].reduce((sum, r) => sum + r.cost, 0);

      const change = currentCost - previousCost;
      const changePercent = previousCost > 0 ? (change / previousCost) * 100 : 0;

      trends.push({
        period: currentPeriod,
        cost: currentCost,
        units: grouped[currentPeriod].reduce((sum, r) => sum + r.units, 0),
        change,
        changePercent,
      });
    }

    return trends;
  }

  private groupRecordsByPeriod(
    records: CostRecord[],
    period: 'day' | 'week' | 'month'
  ): Record<string, CostRecord[]> {
    const grouped: Record<string, CostRecord[]> = {};

    for (const record of records) {
      const periodStart = this.getPeriodStart(record.timestamp, period);
      const periodKey = new Date(periodStart).toISOString().split('T')[0];

      if (!grouped[periodKey]) {
        grouped[periodKey] = [];
      }
      grouped[periodKey].push(record);
    }

    return grouped;
  }

  private calculateProjections(
    records: CostRecord[],
    period: 'day' | 'week' | 'month' | 'year'
  ): CostMetrics['projections'] {
    const now = Date.now();
    const periodStart = this.getPeriodStart(now, period);
    const periodRecords = records.filter(r => r.timestamp >= periodStart);

    const periodCost = periodRecords.reduce((sum, r) => sum + r.cost, 0);
    const periodDuration = now - periodStart;
    const periodDurationMs = this.getPeriodDurationMs(period);
    const completionRatio = periodDuration / periodDurationMs;

    const projectedPeriodCost = completionRatio > 0 ? periodCost / completionRatio : 0;

    return {
      daily: this.projectToPeriod(projectedPeriodCost, period, 'day'),
      weekly: this.projectToPeriod(projectedPeriodCost, period, 'week'),
      monthly: this.projectToPeriod(projectedPeriodCost, period, 'month'),
      yearly: this.projectToPeriod(projectedPeriodCost, period, 'year'),
    };
  }

  private getPeriodDurationMs(period: 'day' | 'week' | 'month' | 'year'): number {
    switch (period) {
      case 'day':
        return 24 * 60 * 60 * 1000;
      case 'week':
        return 7 * 24 * 60 * 60 * 1000;
      case 'month':
        return 30 * 24 * 60 * 60 * 1000;
      case 'year':
        return 365 * 24 * 60 * 60 * 1000;
    }
  }

  private projectToPeriod(cost: number, fromPeriod: string, toPeriod: string): number {
    const fromMs = this.getPeriodDurationMs(fromPeriod as any);
    const toMs = this.getPeriodDurationMs(toPeriod as any);
    return (cost / fromMs) * toMs;
  }

  private groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
    return array.reduce(
      (groups, item) => {
        const group = String(item[key]);
        groups[group] = groups[group] || [];
        groups[group].push(item);
        return groups;
      },
      {} as Record<string, T[]>
    );
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
