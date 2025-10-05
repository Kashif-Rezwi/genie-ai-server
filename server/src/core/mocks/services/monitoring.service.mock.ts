import { 
  IMonitoringService,
  BusinessMetrics,
  BusinessTrend,
  MetricsData
} from '../../interfaces/services';

/**
 * Mock implementation of IMonitoringService for testing
 */
export class MockMonitoringService implements IMonitoringService {
  private mockMetrics: MetricsData = {
    requests: {
      total: 0,
      success: 0,
      errors: 0,
      avgResponseTime: 0,
      byMethod: {},
      byEndpoint: {},
      byStatus: {},
    },
    errors: {
      total: 0,
      byStatus: {},
      byEndpoint: {},
      byType: {},
      recent: [],
    },
    performance: {
      avgResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      throughput: 0,
    },
    business: {
      totalUsers: 0,
      activeUsers: 0,
      totalRevenue: 0,
      totalCreditsUsed: 0,
    },
    system: {
      memoryUsage: 0,
      cpuUsage: 0,
      diskUsage: 0,
      queueSize: 0,
      cacheHitRate: 0,
    },
  };

  private mockBusinessMetrics: BusinessMetrics = {
    users: {
      total: 0,
      active: 0,
      new: 0,
      churned: 0,
      retention: { day1: 0, day7: 0, day30: 0 },
    },
    revenue: {
      total: 0,
      monthly: 0,
      daily: 0,
      byPackage: {},
      growth: { day: 0, week: 0, month: 0 },
    },
    credits: {
      totalUsed: 0,
      totalPurchased: 0,
      averagePerUser: 0,
      utilizationRate: 0,
      byModel: {},
    },
    engagement: {
      averageSessionDuration: 0,
      messagesPerUser: 0,
      chatsPerUser: 0,
      dailyActiveUsers: 0,
      weeklyActiveUsers: 0,
      monthlyActiveUsers: 0,
    },
    conversion: {
      signupToFirstPurchase: 0,
      trialToPaid: 0,
      freeToPaid: 0,
      overall: 0,
    },
    ai: {
      totalRequests: 0,
      requestsPerUser: 0,
      averageTokensPerRequest: 0,
      modelUsage: {},
      responseTime: { average: 0, p95: 0, p99: 0 },
    },
    support: {
      totalTickets: 0,
      averageResolutionTime: 0,
      satisfactionScore: 0,
      byPriority: {},
    },
  };

  async recordMetric(name: string, value: number, tags?: Record<string, string>): Promise<void> {
    this.mockMetrics.requests.total++;
    this.mockMetrics.requests.success++;
    this.mockMetrics.requests.avgResponseTime = 
      (this.mockMetrics.requests.avgResponseTime + value) / 2;
  }

  async recordAIRequest(creditsUsed: number, responseTime?: number, model?: string): Promise<void> {
    this.mockBusinessMetrics.ai.totalRequests++;
    this.mockBusinessMetrics.credits.totalUsed += creditsUsed;
    
    if (responseTime) {
      this.mockBusinessMetrics.ai.responseTime.average = 
        (this.mockBusinessMetrics.ai.responseTime.average + responseTime) / 2;
    }

    if (model) {
      this.mockBusinessMetrics.ai.modelUsage[model] = 
        (this.mockBusinessMetrics.ai.modelUsage[model] || 0) + 1;
    }
  }

  async recordPayment(amount: number, currency: string, status: string): Promise<void> {
    this.mockBusinessMetrics.revenue.total += amount;
    this.mockBusinessMetrics.revenue.daily += amount;
    this.mockBusinessMetrics.revenue.monthly += amount;
  }

  async recordUserActivity(userId: string, activity: string, metadata?: Record<string, any>): Promise<void> {
    this.mockBusinessMetrics.users.active++;
    this.mockBusinessMetrics.engagement.dailyActiveUsers++;
  }

  async getMetrics(timeRange?: string): Promise<MetricsData> {
    return { ...this.mockMetrics };
  }

  async getBusinessMetrics(timeRange?: string): Promise<BusinessMetrics> {
    return { ...this.mockBusinessMetrics };
  }

  async getBusinessTrends(metric: string, timeRange?: string): Promise<BusinessTrend[]> {
    return [
      {
        metric,
        value: 100,
        change: 10,
        changeType: 'increase',
        timestamp: new Date(),
        period: timeRange || '7d',
      },
    ];
  }

  async logError(message: string, error: Error, context?: Record<string, any>): Promise<void> {
    this.mockMetrics.errors.total++;
    this.mockMetrics.errors.recent.push({
      timestamp: new Date(),
      message: error.message,
      stack: error.stack,
      context,
    });
  }

  async logInfo(message: string, context?: Record<string, any>): Promise<void> {
    // Mock info logging
  }

  async logWarning(message: string, context?: Record<string, any>): Promise<void> {
    // Mock warning logging
  }

  // Test helpers
  setMockMetrics(metrics: Partial<MetricsData>): void {
    this.mockMetrics = { ...this.mockMetrics, ...metrics };
  }

  setMockBusinessMetrics(metrics: Partial<BusinessMetrics>): void {
    this.mockBusinessMetrics = { ...this.mockBusinessMetrics, ...metrics };
  }

  getMockMetrics(): MetricsData {
    return { ...this.mockMetrics };
  }

  getMockBusinessMetrics(): BusinessMetrics {
    return { ...this.mockBusinessMetrics };
  }

  clearMockData(): void {
    this.mockMetrics = {
      requests: { total: 0, success: 0, errors: 0, avgResponseTime: 0, byMethod: {}, byEndpoint: {}, byStatus: {} },
      errors: { total: 0, byStatus: {}, byEndpoint: {}, byType: {}, recent: [] },
      performance: { avgResponseTime: 0, p95ResponseTime: 0, p99ResponseTime: 0, throughput: 0 },
      business: { totalUsers: 0, activeUsers: 0, totalRevenue: 0, totalCreditsUsed: 0 },
      system: { memoryUsage: 0, cpuUsage: 0, diskUsage: 0, queueSize: 0, cacheHitRate: 0 },
    };
    this.mockBusinessMetrics = {
      users: { total: 0, active: 0, new: 0, churned: 0, retention: { day1: 0, day7: 0, day30: 0 } },
      revenue: { total: 0, monthly: 0, daily: 0, byPackage: {}, growth: { day: 0, week: 0, month: 0 } },
      credits: { totalUsed: 0, totalPurchased: 0, averagePerUser: 0, utilizationRate: 0, byModel: {} },
      engagement: { averageSessionDuration: 0, messagesPerUser: 0, chatsPerUser: 0, dailyActiveUsers: 0, weeklyActiveUsers: 0, monthlyActiveUsers: 0 },
      conversion: { signupToFirstPurchase: 0, trialToPaid: 0, freeToPaid: 0, overall: 0 },
      ai: { totalRequests: 0, requestsPerUser: 0, averageTokensPerRequest: 0, modelUsage: {}, responseTime: { average: 0, p95: 0, p99: 0 } },
      support: { totalTickets: 0, averageResolutionTime: 0, satisfactionScore: 0, byPriority: {} },
    };
  }
}
