import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
import { LoggingService } from './logging.service';

export interface APMTransaction {
  id: string;
  name: string;
  type: 'http' | 'database' | 'redis' | 'ai' | 'payment' | 'custom';
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'started' | 'completed' | 'failed';
  userId?: string;
  metadata?: Record<string, any>;
  tags?: Record<string, string>;
  parentId?: string;
  children?: string[];
}

export interface APMSpan {
  id: string;
  transactionId: string;
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'started' | 'completed' | 'failed';
  metadata?: Record<string, any>;
  tags?: Record<string, string>;
}

export interface APMError {
  id: string;
  transactionId?: string;
  spanId?: string;
  message: string;
  stack?: string;
  type: string;
  timestamp: number;
  userId?: string;
  context?: Record<string, any>;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface APMMetrics {
  transactions: {
    total: number;
    active: number;
    completed: number;
    failed: number;
    avgDuration: number;
    p95Duration: number;
    p99Duration: number;
  };
  spans: {
    total: number;
    active: number;
    completed: number;
    failed: number;
    avgDuration: number;
  };
  errors: {
    total: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    recent: APMError[];
  };
  performance: {
    throughput: number; // transactions per minute
    errorRate: number;
    responseTime: {
      p50: number;
      p95: number;
      p99: number;
    };
  };
}

@Injectable()
export class APMService {
  private readonly logger = new Logger(APMService.name);
  private readonly activeTransactions = new Map<string, APMTransaction>();
  private readonly activeSpans = new Map<string, APMSpan>();
  private readonly transactionHistory: APMTransaction[] = [];
  private readonly spanHistory: APMSpan[] = [];
  private readonly errorHistory: APMError[] = [];
  private readonly maxHistorySize = 10000;

  constructor(
    private readonly redisService: RedisService,
    private readonly loggingService: LoggingService,
  ) {}

  /**
   * Start a new APM transaction
   */
  startTransaction(
    name: string,
    type: APMTransaction['type'],
    userId?: string,
    metadata?: Record<string, any>,
    tags?: Record<string, string>,
    parentId?: string,
  ): string {
    const id = this.generateId();
    const startTime = Date.now();

    const transaction: APMTransaction = {
      id,
      name,
      type,
      startTime,
      status: 'started',
      userId,
      metadata,
      tags,
      parentId,
      children: [],
    };

    this.activeTransactions.set(id, transaction);

    // Add to parent's children if exists
    if (parentId && this.activeTransactions.has(parentId)) {
      const parent = this.activeTransactions.get(parentId)!;
      parent.children = parent.children || [];
      parent.children.push(id);
    }

    this.loggingService.log(
      `APM Transaction started: ${name} (${type})`,
      'monitoring',
    );

    return id;
  }

  /**
   * End an APM transaction
   */
  endTransaction(
    transactionId: string,
    status: 'completed' | 'failed' = 'completed',
    metadata?: Record<string, any>,
  ): void {
    const transaction = this.activeTransactions.get(transactionId);
    if (!transaction) {
      this.logger.warn(`Transaction ${transactionId} not found`);
      return;
    }

    const endTime = Date.now();
    const duration = endTime - transaction.startTime;

    transaction.endTime = endTime;
    transaction.duration = duration;
    transaction.status = status;

    if (metadata) {
      transaction.metadata = { ...transaction.metadata, ...metadata };
    }

    // Move to history
    this.transactionHistory.push({ ...transaction });
    this.activeTransactions.delete(transactionId);

    // Cleanup old history
    if (this.transactionHistory.length > this.maxHistorySize) {
      this.transactionHistory.splice(0, this.transactionHistory.length - this.maxHistorySize);
    }

    this.loggingService.log(
      `APM Transaction ended: ${transaction.name} (${status}) - ${duration}ms`,
      'monitoring',
    );
  }

  /**
   * Start a new APM span within a transaction
   */
  startSpan(
    transactionId: string,
    name: string,
    metadata?: Record<string, any>,
    tags?: Record<string, string>,
  ): string {
    const spanId = this.generateId();
    const startTime = Date.now();

    const span: APMSpan = {
      id: spanId,
      transactionId,
      name,
      startTime,
      status: 'started',
      metadata,
      tags,
    };

    this.activeSpans.set(spanId, span);

    this.loggingService.log(
      `APM Span started: ${name}`,
      'monitoring',
    );

    return spanId;
  }

  /**
   * End an APM span
   */
  endSpan(
    spanId: string,
    status: 'completed' | 'failed' = 'completed',
    metadata?: Record<string, any>,
  ): void {
    const span = this.activeSpans.get(spanId);
    if (!span) {
      this.logger.warn(`Span ${spanId} not found`);
      return;
    }

    const endTime = Date.now();
    const duration = endTime - span.startTime;

    span.endTime = endTime;
    span.duration = duration;
    span.status = status;

    if (metadata) {
      span.metadata = { ...span.metadata, ...metadata };
    }

    // Move to history
    this.spanHistory.push({ ...span });
    this.activeSpans.delete(spanId);

    // Cleanup old history
    if (this.spanHistory.length > this.maxHistorySize) {
      this.spanHistory.splice(0, this.spanHistory.length - this.maxHistorySize);
    }

    this.loggingService.log(
      `APM Span ended: ${span.name} (${status}) - ${duration}ms`,
      'monitoring',
    );
  }

  /**
   * Record an APM error
   */
  recordError(
    message: string,
    type: string,
    severity: APMError['severity'] = 'medium',
    transactionId?: string,
    spanId?: string,
    userId?: string,
    context?: Record<string, any>,
    stack?: string,
  ): string {
    const errorId = this.generateId();
    const timestamp = Date.now();

    const error: APMError = {
      id: errorId,
      transactionId,
      spanId,
      message,
      stack,
      type,
      timestamp,
      userId,
      context,
      severity,
    };

    this.errorHistory.push(error);

    // Cleanup old errors
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory.splice(0, this.errorHistory.length - this.maxHistorySize);
    }

    this.loggingService.log(
      `APM Error recorded: ${message}`,
      'monitoring',
    );

    return errorId;
  }

  /**
   * Get APM metrics
   */
  getMetrics(): APMMetrics {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Transaction metrics
    const allTransactions = [...this.transactionHistory, ...this.activeTransactions.values()];
    const recentTransactions = allTransactions.filter(t => t.startTime >= oneMinuteAgo);
    const completedTransactions = this.transactionHistory.filter(t => t.status === 'completed');
    const failedTransactions = this.transactionHistory.filter(t => t.status === 'failed');

    const transactionDurations = completedTransactions
      .map(t => t.duration || 0)
      .filter(d => d > 0);

    // Span metrics
    const allSpans = [...this.spanHistory, ...this.activeSpans.values()];
    const completedSpans = this.spanHistory.filter(s => s.status === 'completed');
    const failedSpans = this.spanHistory.filter(s => s.status === 'failed');

    const spanDurations = completedSpans
      .map(s => s.duration || 0)
      .filter(d => d > 0);

    // Error metrics
    const recentErrors = this.errorHistory.filter(e => e.timestamp >= oneMinuteAgo);
    const errorsByType = this.groupBy(this.errorHistory, 'type');
    const errorsBySeverity = this.groupBy(this.errorHistory, 'severity');

    // Performance metrics
    const responseTimes = transactionDurations.sort((a, b) => a - b);
    const throughput = recentTransactions.length;

    return {
      transactions: {
        total: allTransactions.length,
        active: this.activeTransactions.size,
        completed: completedTransactions.length,
        failed: failedTransactions.length,
        avgDuration: this.calculateAverage(transactionDurations),
        p95Duration: this.calculatePercentile(transactionDurations, 95),
        p99Duration: this.calculatePercentile(transactionDurations, 99),
      },
      spans: {
        total: allSpans.length,
        active: this.activeSpans.size,
        completed: completedSpans.length,
        failed: failedSpans.length,
        avgDuration: this.calculateAverage(spanDurations),
      },
      errors: {
        total: this.errorHistory.length,
        byType: this.countBy(errorsByType),
        bySeverity: this.countBy(errorsBySeverity),
        recent: this.errorHistory.slice(-50),
      },
      performance: {
        throughput,
        errorRate: allTransactions.length > 0 ? (failedTransactions.length / allTransactions.length) * 100 : 0,
        responseTime: {
          p50: this.calculatePercentile(responseTimes, 50),
          p95: this.calculatePercentile(responseTimes, 95),
          p99: this.calculatePercentile(responseTimes, 99),
        },
      },
    };
  }

  /**
   * Get transaction details
   */
  getTransaction(transactionId: string): APMTransaction | null {
    return this.activeTransactions.get(transactionId) || 
           this.transactionHistory.find(t => t.id === transactionId) || 
           null;
  }

  /**
   * Get span details
   */
  getSpan(spanId: string): APMSpan | null {
    return this.activeSpans.get(spanId) || 
           this.spanHistory.find(s => s.id === spanId) || 
           null;
  }

  /**
   * Get error details
   */
  getError(errorId: string): APMError | null {
    return this.errorHistory.find(e => e.id === errorId) || null;
  }

  /**
   * Get transactions by user
   */
  getTransactionsByUser(userId: string, limit = 100): APMTransaction[] {
    return this.transactionHistory
      .filter(t => t.userId === userId)
      .slice(-limit);
  }

  /**
   * Get recent transactions
   */
  getRecentTransactions(limit = 100): APMTransaction[] {
    return this.transactionHistory.slice(-limit);
  }

  /**
   * Get recent spans for a transaction
   */
  getSpansForTransaction(transactionId: string): APMSpan[] {
    return this.spanHistory.filter(s => s.transactionId === transactionId);
  }

  /**
   * Clear old data
   */
  clearOldData(olderThanHours = 24): void {
    const cutoff = Date.now() - (olderThanHours * 60 * 60 * 1000);
    
    // Clear old transactions
    const oldTransactionCount = this.transactionHistory.length;
    this.transactionHistory.splice(
      0,
      this.transactionHistory.findIndex(t => t.startTime >= cutoff)
    );

    // Clear old spans
    const oldSpanCount = this.spanHistory.length;
    this.spanHistory.splice(
      0,
      this.spanHistory.findIndex(s => s.startTime >= cutoff)
    );

    // Clear old errors
    const oldErrorCount = this.errorHistory.length;
    this.errorHistory.splice(
      0,
      this.errorHistory.findIndex(e => e.timestamp >= cutoff)
    );

    this.logger.log(
      `Cleared old APM data: ${oldTransactionCount} transactions, ${oldSpanCount} spans, ${oldErrorCount} errors`,
    );
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private calculateAverage(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
  }

  private calculatePercentile(numbers: number[], percentile: number): number {
    if (numbers.length === 0) return 0;
    const sorted = [...numbers].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
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
}
