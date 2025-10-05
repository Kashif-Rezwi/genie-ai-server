// Define interfaces locally to avoid circular dependencies
export interface BusinessMetrics {
  users: {
    total: number;
    active: number;
    new: number;
    churned: number;
    retention: {
      day1: number;
      day7: number;
      day30: number;
    };
  };
  revenue: {
    total: number;
    monthly: number;
    daily: number;
    byPackage: Record<string, number>;
    growth: {
      day: number;
      week: number;
      month: number;
    };
  };
  credits: {
    totalUsed: number;
    totalPurchased: number;
    averagePerUser: number;
    utilizationRate: number;
    byModel: Record<string, number>;
  };
  engagement: {
    averageSessionDuration: number;
    messagesPerUser: number;
    chatsPerUser: number;
    dailyActiveUsers: number;
    weeklyActiveUsers: number;
    monthlyActiveUsers: number;
  };
  conversion: {
    signupToFirstPurchase: number;
    trialToPaid: number;
    freeToPaid: number;
    overall: number;
  };
  ai: {
    totalRequests: number;
    requestsPerUser: number;
    averageTokensPerRequest: number;
    modelUsage: Record<string, number>;
    responseTime: {
      average: number;
      p95: number;
      p99: number;
    };
  };
  support: {
    totalTickets: number;
    averageResolutionTime: number;
    satisfactionScore: number;
    byPriority: Record<string, number>;
  };
}

export interface BusinessTrend {
  metric: string;
  value: number;
  change: number;
  changeType: 'increase' | 'decrease' | 'stable';
  timestamp: Date;
  period: string;
}

export interface MetricsData {
  requests: {
    total: number;
    success: number;
    errors: number;
    avgResponseTime: number;
    byMethod: Record<string, number>;
    byEndpoint: Record<string, number>;
    byStatus: Record<number, number>;
  };
  errors: {
    total: number;
    byStatus: Record<number, number>;
    byEndpoint: Record<string, number>;
    byType: Record<string, number>;
    recent: Array<{
      timestamp: Date;
      message: string;
      stack?: string;
      context?: Record<string, any>;
    }>;
  };
  performance: {
    avgResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    throughput: number;
  };
  business: {
    totalUsers: number;
    activeUsers: number;
    totalRevenue: number;
    totalCreditsUsed: number;
  };
  system: {
    memoryUsage: number;
    cpuUsage: number;
    diskUsage: number;
    queueSize: number;
    cacheHitRate: number;
  };
}

/**
 * Interface for Monitoring Service
 * Defines the contract for monitoring and metrics operations
 */
export interface IMonitoringService {
  /**
   * Record a metric
   * @param name - Metric name
   * @param value - Metric value
   * @param tags - Optional tags
   * @returns Promise<void>
   */
  recordMetric(name: string, value: number, tags?: Record<string, string>): Promise<void>;

  /**
   * Record AI request metrics
   * @param creditsUsed - Credits used for the request
   * @param responseTime - Response time in milliseconds
   * @param model - AI model used
   * @returns Promise<void>
   */
  recordAIRequest(creditsUsed: number, responseTime?: number, model?: string): Promise<void>;

  /**
   * Record payment metrics
   * @param amount - Payment amount
   * @param currency - Payment currency
   * @param status - Payment status
   * @returns Promise<void>
   */
  recordPayment(amount: number, currency: string, status: string): Promise<void>;

  /**
   * Record user activity
   * @param userId - User ID
   * @param activity - Activity type
   * @param metadata - Optional metadata
   * @returns Promise<void>
   */
  recordUserActivity(
    userId: string,
    activity: string,
    metadata?: Record<string, any>
  ): Promise<void>;

  /**
   * Get metrics data
   * @param timeRange - Time range for metrics
   * @returns Promise<MetricsData> - Metrics data
   */
  getMetrics(timeRange?: string): Promise<MetricsData>;

  /**
   * Get business metrics
   * @param timeRange - Time range for metrics
   * @returns Promise<BusinessMetrics> - Business metrics
   */
  getBusinessMetrics(timeRange?: string): Promise<BusinessMetrics>;

  /**
   * Get business trends
   * @param metric - Metric to analyze
   * @param timeRange - Time range for analysis
   * @returns Promise<BusinessTrend[]> - Business trends
   */
  getBusinessTrends(metric: string, timeRange?: string): Promise<BusinessTrend[]>;

  /**
   * Log an error
   * @param message - Error message
   * @param error - Error object
   * @param context - Additional context
   * @returns Promise<void>
   */
  logError(message: string, error: Error, context?: Record<string, any>): Promise<void>;

  /**
   * Log an info message
   * @param message - Info message
   * @param context - Additional context
   * @returns Promise<void>
   */
  logInfo(message: string, context?: Record<string, any>): Promise<void>;

  /**
   * Log a warning
   * @param message - Warning message
   * @param context - Additional context
   * @returns Promise<void>
   */
  logWarning(message: string, context?: Record<string, any>): Promise<void>;
}
