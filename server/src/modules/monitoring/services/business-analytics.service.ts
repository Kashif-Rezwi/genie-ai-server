import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RedisService } from '../../redis/redis.service';
import { LoggingService } from './logging.service';
import { User } from '../../../entities/user.entity';
import { CreditTransaction } from '../../../entities/credit-transaction.entity';
import { Payment } from '../../../entities/payment.entity';
import { Chat } from '../../../entities/chat.entity';
import { Message } from '../../../entities/message.entity';

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
  previousValue: number;
  change: number;
  changePercent: number;
  trend: 'up' | 'down' | 'stable';
  period: 'hour' | 'day' | 'week' | 'month';
}

export interface BusinessInsight {
  id: string;
  type: 'revenue' | 'user' | 'engagement' | 'conversion' | 'performance' | 'anomaly';
  title: string;
  description: string;
  impact: 'positive' | 'negative' | 'neutral';
  confidence: number; // 0-100
  timestamp: number;
  data: Record<string, any>;
  recommendations?: string[];
}

@Injectable()
export class BusinessAnalyticsService {
  private readonly logger = new Logger(BusinessAnalyticsService.name);
  private readonly insights: BusinessInsight[] = [];
  private readonly maxInsights = 1000;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(CreditTransaction)
    private readonly creditTransactionRepository: Repository<CreditTransaction>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Chat)
    private readonly chatRepository: Repository<Chat>,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    private readonly redisService: RedisService,
    private readonly loggingService: LoggingService,
  ) {}

  /**
   * Get comprehensive business metrics
   */
  async getBusinessMetrics(): Promise<BusinessMetrics> {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // User metrics
    const [totalUsers, activeUsers, newUsers, churnedUsers] = await Promise.all([
      this.userRepository.count(),
      this.getActiveUsers(oneDayAgo),
      this.getNewUsers(oneDayAgo),
      this.getChurnedUsers(oneMonthAgo),
    ]);

    // Revenue metrics
    const [totalRevenue, monthlyRevenue, dailyRevenue, revenueByPackage] = await Promise.all([
      this.getTotalRevenue(),
      this.getRevenueForPeriod(oneMonthAgo, now),
      this.getRevenueForPeriod(oneDayAgo, now),
      this.getRevenueByPackage(oneMonthAgo, now),
    ]);

    // Credit metrics
    const [totalCreditsUsed, totalCreditsPurchased, creditsByModel] = await Promise.all([
      this.getTotalCreditsUsed(),
      this.getTotalCreditsPurchased(),
      this.getCreditsByModel(oneMonthAgo, now),
    ]);

    // Engagement metrics
    const [avgSessionDuration, messagesPerUser, chatsPerUser, dau, wau, mau] = await Promise.all([
      this.getAverageSessionDuration(oneDayAgo, now),
      this.getMessagesPerUser(oneMonthAgo, now),
      this.getChatsPerUser(oneMonthAgo, now),
      this.getDailyActiveUsers(oneDayAgo, now),
      this.getWeeklyActiveUsers(oneWeekAgo, now),
      this.getMonthlyActiveUsers(oneMonthAgo, now),
    ]);

    // Conversion metrics
    const [signupToFirstPurchase, trialToPaid, freeToPaid, overallConversion] = await Promise.all([
      this.getSignupToFirstPurchaseRate(oneMonthAgo, now),
      this.getTrialToPaidRate(oneMonthAgo, now),
      this.getFreeToPaidRate(oneMonthAgo, now),
      this.getOverallConversionRate(oneMonthAgo, now),
    ]);

    // AI metrics
    const [totalAiRequests, aiRequestsPerUser, avgTokensPerRequest, modelUsage, aiResponseTime] = await Promise.all([
      this.getTotalAiRequests(oneMonthAgo, now),
      this.getAiRequestsPerUser(oneMonthAgo, now),
      this.getAverageTokensPerRequest(oneMonthAgo, now),
      this.getModelUsage(oneMonthAgo, now),
      this.getAiResponseTime(oneMonthAgo, now),
    ]);

    // Support metrics (placeholder - would need support ticket system)
    const supportMetrics = {
      totalTickets: 0,
      averageResolutionTime: 0,
      satisfactionScore: 0,
      byPriority: {},
    };

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        new: newUsers,
        churned: churnedUsers,
        retention: {
          day1: await this.getRetentionRate(1),
          day7: await this.getRetentionRate(7),
          day30: await this.getRetentionRate(30),
        },
      },
      revenue: {
        total: totalRevenue,
        monthly: monthlyRevenue,
        daily: dailyRevenue,
        byPackage: revenueByPackage,
        growth: {
          day: await this.getRevenueGrowth('day'),
          week: await this.getRevenueGrowth('week'),
          month: await this.getRevenueGrowth('month'),
        },
      },
      credits: {
        totalUsed: totalCreditsUsed,
        totalPurchased: totalCreditsPurchased,
        averagePerUser: totalUsers > 0 ? totalCreditsUsed / totalUsers : 0,
        utilizationRate: totalCreditsPurchased > 0 ? (totalCreditsUsed / totalCreditsPurchased) * 100 : 0,
        byModel: creditsByModel,
      },
      engagement: {
        averageSessionDuration: avgSessionDuration,
        messagesPerUser: messagesPerUser,
        chatsPerUser: chatsPerUser,
        dailyActiveUsers: dau,
        weeklyActiveUsers: wau,
        monthlyActiveUsers: mau,
      },
      conversion: {
        signupToFirstPurchase: signupToFirstPurchase,
        trialToPaid: trialToPaid,
        freeToPaid: freeToPaid,
        overall: overallConversion,
      },
      ai: {
        totalRequests: totalAiRequests,
        requestsPerUser: aiRequestsPerUser,
        averageTokensPerRequest: avgTokensPerRequest,
        modelUsage: modelUsage,
        responseTime: aiResponseTime,
      },
      support: supportMetrics,
    };
  }

  /**
   * Get business trends
   */
  async getBusinessTrends(period: 'hour' | 'day' | 'week' | 'month' = 'day'): Promise<BusinessTrend[]> {
    const trends: BusinessTrend[] = [];
    const now = new Date();
    const currentPeriod = this.getPeriodStart(now, period);
    const previousPeriod = this.getPeriodStart(new Date(currentPeriod.getTime() - this.getPeriodDuration(period)), period);

    // Revenue trend
    const currentRevenue = await this.getRevenueForPeriod(currentPeriod, now);
    const previousRevenue = await this.getRevenueForPeriod(previousPeriod, currentPeriod);
    trends.push(this.calculateTrend('revenue', currentRevenue, previousRevenue, period));

    // User trend
    const currentUsers = await this.getNewUsers(currentPeriod);
    const previousUsers = await this.getNewUsers(previousPeriod);
    trends.push(this.calculateTrend('new_users', currentUsers, previousUsers, period));

    // AI requests trend
    const currentAiRequests = await this.getTotalAiRequests(currentPeriod, now);
    const previousAiRequests = await this.getTotalAiRequests(previousPeriod, currentPeriod);
    trends.push(this.calculateTrend('ai_requests', currentAiRequests, previousAiRequests, period));

    // Credit usage trend
    const currentCredits = await this.getTotalCreditsUsed(currentPeriod, now);
    const previousCredits = await this.getTotalCreditsUsed(previousPeriod, currentPeriod);
    trends.push(this.calculateTrend('credits_used', currentCredits, previousCredits, period));

    return trends;
  }

  /**
   * Generate business insights
   */
  async generateInsights(): Promise<BusinessInsight[]> {
    const insights: BusinessInsight[] = [];
    const metrics = await this.getBusinessMetrics();
    const trends = await this.getBusinessTrends('day');

    // Revenue insights
    if (metrics.revenue.growth.day > 20) {
      insights.push({
        id: this.generateId(),
        type: 'revenue',
        title: 'Strong Revenue Growth',
        description: `Revenue increased by ${metrics.revenue.growth.day.toFixed(1)}% today`,
        impact: 'positive',
        confidence: 85,
        timestamp: Date.now(),
        data: { growth: metrics.revenue.growth.day },
        recommendations: ['Continue current marketing strategies', 'Consider scaling infrastructure'],
      });
    }

    // User engagement insights
    if (metrics.engagement.dailyActiveUsers > metrics.users.total * 0.1) {
      insights.push({
        id: this.generateId(),
        type: 'engagement',
        title: 'High Daily Engagement',
        description: `${((metrics.engagement.dailyActiveUsers / metrics.users.total) * 100).toFixed(1)}% of users are active daily`,
        impact: 'positive',
        confidence: 90,
        timestamp: Date.now(),
        data: { engagementRate: metrics.engagement.dailyActiveUsers / metrics.users.total },
        recommendations: ['Maintain current engagement strategies', 'Consider gamification features'],
      });
    }

    // Conversion insights
    if (metrics.conversion.overall < 0.05) {
      insights.push({
        id: this.generateId(),
        type: 'conversion',
        title: 'Low Conversion Rate',
        description: `Overall conversion rate is ${(metrics.conversion.overall * 100).toFixed(2)}%`,
        impact: 'negative',
        confidence: 80,
        timestamp: Date.now(),
        data: { conversionRate: metrics.conversion.overall },
        recommendations: ['Review pricing strategy', 'Improve onboarding flow', 'Add free trial period'],
      });
    }

    // AI performance insights
    if (metrics.ai.responseTime.average > 5000) {
      insights.push({
        id: this.generateId(),
        type: 'performance',
        title: 'Slow AI Response Times',
        description: `Average AI response time is ${(metrics.ai.responseTime.average / 1000).toFixed(1)}s`,
        impact: 'negative',
        confidence: 75,
        timestamp: Date.now(),
        data: { responseTime: metrics.ai.responseTime.average },
        recommendations: ['Optimize AI model performance', 'Consider caching strategies', 'Review infrastructure capacity'],
      });
    }

    // Store insights
    this.insights.push(...insights);
    if (this.insights.length > this.maxInsights) {
      this.insights.splice(0, this.insights.length - this.maxInsights);
    }

    return insights;
  }

  /**
   * Get business insights
   */
  getInsights(limit = 50): BusinessInsight[] {
    return this.insights.slice(-limit);
  }

  /**
   * Get insights by type
   */
  getInsightsByType(type: BusinessInsight['type'], limit = 50): BusinessInsight[] {
    return this.insights
      .filter(insight => insight.type === type)
      .slice(-limit);
  }

  // Helper methods for calculating metrics

  private async getActiveUsers(since: Date): Promise<number> {
    const result = await this.userRepository
      .createQueryBuilder('user')
      .where('user.lastLoginAt >= :since', { since })
      .getCount();
    return result;
  }

  private async getNewUsers(since: Date): Promise<number> {
    const result = await this.userRepository
      .createQueryBuilder('user')
      .where('user.createdAt >= :since', { since })
      .getCount();
    return result;
  }

  private async getChurnedUsers(since: Date): Promise<number> {
    const result = await this.userRepository
      .createQueryBuilder('user')
      .where('user.lastLoginAt < :since', { since })
      .andWhere('user.createdAt < :since', { since })
      .getCount();
    return result;
  }

  private async getTotalRevenue(): Promise<number> {
    const result = await this.paymentRepository
      .createQueryBuilder('payment')
      .select('SUM(payment.amount)', 'total')
      .where('payment.status = :status', { status: 'completed' })
      .getRawOne();
    return parseFloat(result.total) || 0;
  }

  private async getRevenueForPeriod(start: Date, end: Date): Promise<number> {
    const result = await this.paymentRepository
      .createQueryBuilder('payment')
      .select('SUM(payment.amount)', 'total')
      .where('payment.status = :status', { status: 'completed' })
      .andWhere('payment.createdAt >= :start', { start })
      .andWhere('payment.createdAt <= :end', { end })
      .getRawOne();
    return parseFloat(result.total) || 0;
  }

  private async getRevenueByPackage(start: Date, end: Date): Promise<Record<string, number>> {
    const results = await this.paymentRepository
      .createQueryBuilder('payment')
      .select('payment.packageId', 'packageId')
      .addSelect('SUM(payment.amount)', 'total')
      .where('payment.status = :status', { status: 'completed' })
      .andWhere('payment.createdAt >= :start', { start })
      .andWhere('payment.createdAt <= :end', { end })
      .groupBy('payment.packageId')
      .getRawMany();

    return results.reduce((acc, result) => {
      acc[result.packageId] = parseFloat(result.total);
      return acc;
    }, {} as Record<string, number>);
  }

  private async getTotalCreditsUsed(since?: Date, until?: Date): Promise<number> {
    let query = this.creditTransactionRepository
      .createQueryBuilder('transaction')
      .select('SUM(transaction.amount)', 'total')
      .where('transaction.type = :type', { type: 'USAGE' });

    if (since) {
      query = query.andWhere('transaction.createdAt >= :since', { since });
    }
    if (until) {
      query = query.andWhere('transaction.createdAt <= :until', { until });
    }

    const result = await query.getRawOne();
    return parseFloat(result.total) || 0;
  }

  private async getTotalCreditsPurchased(): Promise<number> {
    const result = await this.creditTransactionRepository
      .createQueryBuilder('transaction')
      .select('SUM(transaction.amount)', 'total')
      .where('transaction.type = :type', { type: 'PURCHASE' })
      .getRawOne();
    return parseFloat(result.total) || 0;
  }

  private async getCreditsByModel(start: Date, end: Date): Promise<Record<string, number>> {
    // This would need to be implemented based on how model usage is tracked
    return {};
  }

  private async getAverageSessionDuration(start: Date, end: Date): Promise<number> {
    // This would need to be implemented based on session tracking
    return 0;
  }

  private async getMessagesPerUser(start: Date, end: Date): Promise<number> {
    const messageCount = await this.messageRepository
      .createQueryBuilder('message')
      .where('message.createdAt >= :start', { start })
      .andWhere('message.createdAt <= :end', { end })
      .getCount();

    const userCount = await this.userRepository.count();
    return userCount > 0 ? messageCount / userCount : 0;
  }

  private async getChatsPerUser(start: Date, end: Date): Promise<number> {
    const chatCount = await this.chatRepository
      .createQueryBuilder('chat')
      .where('chat.createdAt >= :start', { start })
      .andWhere('chat.createdAt <= :end', { end })
      .getCount();

    const userCount = await this.userRepository.count();
    return userCount > 0 ? chatCount / userCount : 0;
  }

  private async getDailyActiveUsers(start: Date, end: Date): Promise<number> {
    return this.getActiveUsers(start);
  }

  private async getWeeklyActiveUsers(start: Date, end: Date): Promise<number> {
    return this.getActiveUsers(start);
  }

  private async getMonthlyActiveUsers(start: Date, end: Date): Promise<number> {
    return this.getActiveUsers(start);
  }

  private async getSignupToFirstPurchaseRate(start: Date, end: Date): Promise<number> {
    // This would need to be implemented based on user journey tracking
    return 0;
  }

  private async getTrialToPaidRate(start: Date, end: Date): Promise<number> {
    // This would need to be implemented based on trial tracking
    return 0;
  }

  private async getFreeToPaidRate(start: Date, end: Date): Promise<number> {
    // This would need to be implemented based on free user tracking
    return 0;
  }

  private async getOverallConversionRate(start: Date, end: Date): Promise<number> {
    // This would need to be implemented based on conversion tracking
    return 0;
  }

  private async getTotalAiRequests(start: Date, end: Date): Promise<number> {
    // This would need to be implemented based on AI request tracking
    return 0;
  }

  private async getAiRequestsPerUser(start: Date, end: Date): Promise<number> {
    const requests = await this.getTotalAiRequests(start, end);
    const users = await this.userRepository.count();
    return users > 0 ? requests / users : 0;
  }

  private async getAverageTokensPerRequest(start: Date, end: Date): Promise<number> {
    // This would need to be implemented based on token tracking
    return 0;
  }

  private async getModelUsage(start: Date, end: Date): Promise<Record<string, number>> {
    // This would need to be implemented based on model usage tracking
    return {};
  }

  private async getAiResponseTime(start: Date, end: Date): Promise<{ average: number; p95: number; p99: number }> {
    // This would need to be implemented based on response time tracking
    return { average: 0, p95: 0, p99: 0 };
  }

  private async getRetentionRate(days: number): Promise<number> {
    // This would need to be implemented based on user activity tracking
    return 0;
  }

  private async getRevenueGrowth(period: 'day' | 'week' | 'month'): Promise<number> {
    // This would need to be implemented based on historical revenue data
    return 0;
  }

  private getPeriodStart(date: Date, period: 'hour' | 'day' | 'week' | 'month'): Date {
    const result = new Date(date);
    switch (period) {
      case 'hour':
        result.setMinutes(0, 0, 0);
        break;
      case 'day':
        result.setHours(0, 0, 0, 0);
        break;
      case 'week':
        result.setDate(result.getDate() - result.getDay());
        result.setHours(0, 0, 0, 0);
        break;
      case 'month':
        result.setDate(1);
        result.setHours(0, 0, 0, 0);
        break;
    }
    return result;
  }

  private getPeriodDuration(period: 'hour' | 'day' | 'week' | 'month'): number {
    switch (period) {
      case 'hour': return 60 * 60 * 1000;
      case 'day': return 24 * 60 * 60 * 1000;
      case 'week': return 7 * 24 * 60 * 60 * 1000;
      case 'month': return 30 * 24 * 60 * 60 * 1000;
    }
  }

  private calculateTrend(metric: string, current: number, previous: number, period: string): BusinessTrend {
    const change = current - previous;
    const changePercent = previous > 0 ? (change / previous) * 100 : 0;
    const trend: 'up' | 'down' | 'stable' = changePercent > 5 ? 'up' : changePercent < -5 ? 'down' : 'stable';

    return {
      metric,
      value: current,
      previousValue: previous,
      change,
      changePercent,
      trend,
      period: period as 'hour' | 'day' | 'week' | 'month',
    };
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
