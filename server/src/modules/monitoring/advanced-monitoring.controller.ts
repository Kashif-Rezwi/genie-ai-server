import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard, Roles, UserRole } from '../security/guards/roles.guard';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { APMService, APMTransaction, APMSpan, APMError } from './services/apm.service';
import { BusinessAnalyticsService, BusinessMetrics, BusinessTrend, BusinessInsight } from './services/business-analytics.service';
import { PerformanceRegressionService, PerformanceTest, PerformanceTestResult, PerformanceReport } from './services/performance-regression.service';
import { CostMonitoringService, CostCategory, CostRecord, CostMetrics, CostBudget, CostAlert } from './services/cost-monitoring.service';
import { BusinessAlertsService, BusinessAlertRule, BusinessAlert, BusinessAlertStats } from './services/business-alerts.service';

@Controller('monitoring/advanced')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdvancedMonitoringController {
  constructor(
    private readonly apmService: APMService,
    private readonly businessAnalyticsService: BusinessAnalyticsService,
    private readonly performanceRegressionService: PerformanceRegressionService,
    private readonly costMonitoringService: CostMonitoringService,
    private readonly businessAlertsService: BusinessAlertsService,
  ) {}

  // APM Endpoints

  @Get('apm/metrics')
  async getAPMMetrics(): Promise<ApiResponseDto> {
    const metrics = this.apmService.getMetrics();
    return {
      success: true,
      message: 'APM metrics retrieved successfully',
      data: metrics,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('apm/transactions')
  async getTransactions(@Query('limit') limit = 100): Promise<ApiResponseDto> {
    const transactions = this.apmService.getRecentTransactions(limit);
    return {
      success: true,
      message: 'APM transactions retrieved successfully',
      data: transactions,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('apm/transactions/:id')
  async getTransaction(@Param('id') id: string): Promise<ApiResponseDto> {
    const transaction = this.apmService.getTransaction(id);
    if (!transaction) {
      return {
        success: false,
        message: 'Transaction not found',
        data: null,
        timestamp: new Date().toISOString(),
      };
    }

    const spans = this.apmService.getSpansForTransaction(id);
    return {
      success: true,
      message: 'APM transaction retrieved successfully',
      data: { transaction, spans },
      timestamp: new Date().toISOString(),
    };
  }

  @Get('apm/spans/:id')
  async getSpan(@Param('id') id: string): Promise<ApiResponseDto> {
    const span = this.apmService.getSpan(id);
    if (!span) {
      return {
        success: false,
        message: 'Span not found',
        data: null,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: true,
      message: 'APM span retrieved successfully',
      data: span,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('apm/errors/:id')
  async getError(@Param('id') id: string): Promise<ApiResponseDto> {
    const error = this.apmService.getError(id);
    if (!error) {
      return {
        success: false,
        message: 'Error not found',
        data: null,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: true,
      message: 'APM error retrieved successfully',
      data: error,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('apm/users/:userId/transactions')
  async getTransactionsByUser(@Param('userId') userId: string, @Query('limit') limit = 100): Promise<ApiResponseDto> {
    const transactions = this.apmService.getTransactionsByUser(userId, limit);
    return {
      success: true,
      message: 'User transactions retrieved successfully',
      data: transactions,
      timestamp: new Date().toISOString(),
    };
  }

  // Business Analytics Endpoints

  @Get('analytics/metrics')
  async getBusinessMetrics(): Promise<ApiResponseDto> {
    const metrics = await this.businessAnalyticsService.getBusinessMetrics();
    return {
      success: true,
      message: 'Business metrics retrieved successfully',
      data: metrics,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('analytics/trends')
  async getBusinessTrends(@Query('period') period: 'hour' | 'day' | 'week' | 'month' = 'day'): Promise<ApiResponseDto> {
    const trends = await this.businessAnalyticsService.getBusinessTrends(period);
    return {
      success: true,
      message: 'Business trends retrieved successfully',
      data: trends,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('analytics/insights')
  async getBusinessInsights(@Query('limit') limit = 50): Promise<ApiResponseDto> {
    const insights = this.businessAnalyticsService.getInsights(limit);
    return {
      success: true,
      message: 'Business insights retrieved successfully',
      data: insights,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('analytics/insights/:type')
  async getInsightsByType(@Param('type') type: string, @Query('limit') limit = 50): Promise<ApiResponseDto> {
    const insights = this.businessAnalyticsService.getInsightsByType(type as any, limit);
    return {
      success: true,
      message: 'Business insights by type retrieved successfully',
      data: insights,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('analytics/insights/generate')
  async generateInsights(): Promise<ApiResponseDto> {
    const insights = await this.businessAnalyticsService.generateInsights();
    return {
      success: true,
      message: 'Business insights generated successfully',
      data: insights,
      timestamp: new Date().toISOString(),
    };
  }

  // Performance Regression Testing Endpoints

  @Get('performance/tests')
  async getPerformanceTests(): Promise<ApiResponseDto> {
    const tests = this.performanceRegressionService.getTests();
    return {
      success: true,
      message: 'Performance tests retrieved successfully',
      data: tests,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('performance/tests/:id')
  async getPerformanceTest(@Param('id') id: string): Promise<ApiResponseDto> {
    const test = this.performanceRegressionService.getTest(id);
    if (!test) {
      return {
        success: false,
        message: 'Performance test not found',
        data: null,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: true,
      message: 'Performance test retrieved successfully',
      data: test,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('performance/tests')
  async createPerformanceTest(@Body() test: Omit<PerformanceTest, 'id' | 'createdAt' | 'lastRun' | 'lastResult'>): Promise<ApiResponseDto> {
    const testId = this.performanceRegressionService.createTest(test);
    return {
      success: true,
      message: 'Performance test created successfully',
      data: { testId },
      timestamp: new Date().toISOString(),
    };
  }

  @Put('performance/tests/:id')
  async updatePerformanceTest(@Param('id') id: string, @Body() updates: Partial<PerformanceTest>): Promise<ApiResponseDto> {
    const success = this.performanceRegressionService.updateTest(id, updates);
    if (!success) {
      return {
        success: false,
        message: 'Performance test not found',
        data: null,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: true,
      message: 'Performance test updated successfully',
      data: null,
      timestamp: new Date().toISOString(),
    };
  }

  @Delete('performance/tests/:id')
  async deletePerformanceTest(@Param('id') id: string): Promise<ApiResponseDto> {
    const success = this.performanceRegressionService.deleteTest(id);
    if (!success) {
      return {
        success: false,
        message: 'Performance test not found',
        data: null,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: true,
      message: 'Performance test deleted successfully',
      data: null,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('performance/tests/:id/run')
  async runPerformanceTest(@Param('id') id: string): Promise<ApiResponseDto> {
    try {
      const result = await this.performanceRegressionService.runTest(id);
      return {
        success: true,
        message: 'Performance test executed successfully',
        data: result,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        data: null,
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Post('performance/tests/run-all')
  async runAllPerformanceTests(): Promise<ApiResponseDto> {
    const results = await this.performanceRegressionService.runAllTests();
    return {
      success: true,
      message: 'All performance tests executed successfully',
      data: results,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('performance/tests/:id/results')
  async getPerformanceTestResults(@Param('id') id: string, @Query('limit') limit = 100): Promise<ApiResponseDto> {
    const results = this.performanceRegressionService.getResults(id, limit);
    return {
      success: true,
      message: 'Performance test results retrieved successfully',
      data: results,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('performance/tests/:id/report')
  async getPerformanceReport(@Param('id') id: string, @Query('days') days = 7): Promise<ApiResponseDto> {
    const report = this.performanceRegressionService.getPerformanceReport(id, days);
    if (!report) {
      return {
        success: false,
        message: 'Performance report not found',
        data: null,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: true,
      message: 'Performance report retrieved successfully',
      data: report,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('performance/tests/:id/baseline')
  async setPerformanceBaseline(@Param('id') id: string, @Query('sampleSize') sampleSize = 10): Promise<ApiResponseDto> {
    const success = this.performanceRegressionService.setBaseline(id, sampleSize);
    if (!success) {
      return {
        success: false,
        message: 'Failed to set performance baseline',
        data: null,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: true,
      message: 'Performance baseline set successfully',
      data: null,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('performance/tests/:id/baseline')
  async getPerformanceBaseline(@Param('id') id: string): Promise<ApiResponseDto> {
    const baseline = this.performanceRegressionService.getBaseline(id);
    if (!baseline) {
      return {
        success: false,
        message: 'Performance baseline not found',
        data: null,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: true,
      message: 'Performance baseline retrieved successfully',
      data: baseline,
      timestamp: new Date().toISOString(),
    };
  }

  // Cost Monitoring Endpoints

  @Get('cost/metrics')
  async getCostMetrics(@Query('period') period: 'day' | 'week' | 'month' | 'year' = 'month'): Promise<ApiResponseDto> {
    const metrics = this.costMonitoringService.getCostMetrics(period);
    return {
      success: true,
      message: 'Cost metrics retrieved successfully',
      data: metrics,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('cost/categories')
  async getCostCategories(): Promise<ApiResponseDto> {
    const categories = this.costMonitoringService.getCategories();
    return {
      success: true,
      message: 'Cost categories retrieved successfully',
      data: categories,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('cost/categories/:id')
  async getCostCategory(@Param('id') id: string): Promise<ApiResponseDto> {
    const category = this.costMonitoringService.getCategory(id);
    if (!category) {
      return {
        success: false,
        message: 'Cost category not found',
        data: null,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: true,
      message: 'Cost category retrieved successfully',
      data: category,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('cost/categories')
  async createCostCategory(@Body() category: Omit<CostCategory, 'id'>): Promise<ApiResponseDto> {
    const categoryId = this.costMonitoringService.createCategory(category);
    return {
      success: true,
      message: 'Cost category created successfully',
      data: { categoryId },
      timestamp: new Date().toISOString(),
    };
  }

  @Put('cost/categories/:id')
  async updateCostCategory(@Param('id') id: string, @Body() updates: Partial<CostCategory>): Promise<ApiResponseDto> {
    const success = this.costMonitoringService.updateCategory(id, updates);
    if (!success) {
      return {
        success: false,
        message: 'Cost category not found',
        data: null,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: true,
      message: 'Cost category updated successfully',
      data: null,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('cost/record')
  async recordCost(@Body() record: {
    categoryId: string;
    units: number;
    userId?: string;
    metadata?: Record<string, any>;
    tags?: Record<string, string>;
  }): Promise<ApiResponseDto> {
    const recordId = this.costMonitoringService.recordCost(
      record.categoryId,
      record.units,
      record.userId,
      record.metadata,
      record.tags,
    );

    return {
      success: true,
      message: 'Cost recorded successfully',
      data: { recordId },
      timestamp: new Date().toISOString(),
    };
  }

  @Get('cost/records')
  async getCostRecords(
    @Query('categoryId') categoryId?: string,
    @Query('userId') userId?: string,
    @Query('startTime') startTime?: number,
    @Query('endTime') endTime?: number,
    @Query('limit') limit = 1000,
  ): Promise<ApiResponseDto> {
    const records = this.costMonitoringService.getRecords(categoryId, userId, startTime, endTime, limit);
    return {
      success: true,
      message: 'Cost records retrieved successfully',
      data: records,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('cost/budgets')
  async getCostBudgets(): Promise<ApiResponseDto> {
    const budgets = this.costMonitoringService.getBudgets();
    return {
      success: true,
      message: 'Cost budgets retrieved successfully',
      data: budgets,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('cost/budgets/:id')
  async getCostBudget(@Param('id') id: string): Promise<ApiResponseDto> {
    const budget = this.costMonitoringService.getBudget(id);
    if (!budget) {
      return {
        success: false,
        message: 'Cost budget not found',
        data: null,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: true,
      message: 'Cost budget retrieved successfully',
      data: budget,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('cost/budgets')
  async createCostBudget(@Body() budget: Omit<CostBudget, 'id' | 'createdAt' | 'updatedAt'>): Promise<ApiResponseDto> {
    const budgetId = this.costMonitoringService.createBudget(budget);
    return {
      success: true,
      message: 'Cost budget created successfully',
      data: { budgetId },
      timestamp: new Date().toISOString(),
    };
  }

  @Put('cost/budgets/:id')
  async updateCostBudget(@Param('id') id: string, @Body() updates: Partial<CostBudget>): Promise<ApiResponseDto> {
    const success = this.costMonitoringService.updateBudget(id, updates);
    if (!success) {
      return {
        success: false,
        message: 'Cost budget not found',
        data: null,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: true,
      message: 'Cost budget updated successfully',
      data: null,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('cost/alerts')
  async getCostAlerts(@Query('resolved') resolved?: boolean, @Query('limit') limit = 100): Promise<ApiResponseDto> {
    const alerts = this.costMonitoringService.getAlerts(resolved, limit);
    return {
      success: true,
      message: 'Cost alerts retrieved successfully',
      data: alerts,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('cost/alerts/:id/acknowledge')
  async acknowledgeCostAlert(@Param('id') id: string): Promise<ApiResponseDto> {
    const success = this.costMonitoringService.acknowledgeAlert(id);
    if (!success) {
      return {
        success: false,
        message: 'Cost alert not found',
        data: null,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: true,
      message: 'Cost alert acknowledged successfully',
      data: null,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('cost/alerts/:id/resolve')
  async resolveCostAlert(@Param('id') id: string): Promise<ApiResponseDto> {
    const success = this.costMonitoringService.resolveAlert(id);
    if (!success) {
      return {
        success: false,
        message: 'Cost alert not found',
        data: null,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: true,
      message: 'Cost alert resolved successfully',
      data: null,
      timestamp: new Date().toISOString(),
    };
  }

  // Business Alerts Endpoints

  @Get('alerts/rules')
  async getBusinessAlertRules(): Promise<ApiResponseDto> {
    const rules = this.businessAlertsService.getRules();
    return {
      success: true,
      message: 'Business alert rules retrieved successfully',
      data: rules,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('alerts/rules/:id')
  async getBusinessAlertRule(@Param('id') id: string): Promise<ApiResponseDto> {
    const rule = this.businessAlertsService.getRule(id);
    if (!rule) {
      return {
        success: false,
        message: 'Business alert rule not found',
        data: null,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: true,
      message: 'Business alert rule retrieved successfully',
      data: rule,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('alerts/rules')
  async createBusinessAlertRule(@Body() rule: Omit<BusinessAlertRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<ApiResponseDto> {
    const ruleId = this.businessAlertsService.createRule(rule);
    return {
      success: true,
      message: 'Business alert rule created successfully',
      data: { ruleId },
      timestamp: new Date().toISOString(),
    };
  }

  @Put('alerts/rules/:id')
  async updateBusinessAlertRule(@Param('id') id: string, @Body() updates: Partial<BusinessAlertRule>): Promise<ApiResponseDto> {
    const success = this.businessAlertsService.updateRule(id, updates);
    if (!success) {
      return {
        success: false,
        message: 'Business alert rule not found',
        data: null,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: true,
      message: 'Business alert rule updated successfully',
      data: null,
      timestamp: new Date().toISOString(),
    };
  }

  @Delete('alerts/rules/:id')
  async deleteBusinessAlertRule(@Param('id') id: string): Promise<ApiResponseDto> {
    const success = this.businessAlertsService.deleteRule(id);
    if (!success) {
      return {
        success: false,
        message: 'Business alert rule not found',
        data: null,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: true,
      message: 'Business alert rule deleted successfully',
      data: null,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('alerts/evaluate')
  async evaluateBusinessAlerts(): Promise<ApiResponseDto> {
    const alerts = await this.businessAlertsService.evaluateRules();
    return {
      success: true,
      message: 'Business alerts evaluated successfully',
      data: alerts,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('alerts')
  async getBusinessAlerts(
    @Query('ruleId') ruleId?: string,
    @Query('severity') severity?: string,
    @Query('resolved') resolved?: boolean,
    @Query('acknowledged') acknowledged?: boolean,
    @Query('limit') limit = 100,
  ): Promise<ApiResponseDto> {
    const alerts = this.businessAlertsService.getAlerts(ruleId, severity, resolved, acknowledged, limit);
    return {
      success: true,
      message: 'Business alerts retrieved successfully',
      data: alerts,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('alerts/stats')
  async getBusinessAlertStats(): Promise<ApiResponseDto> {
    const stats = this.businessAlertsService.getAlertStats();
    return {
      success: true,
      message: 'Business alert statistics retrieved successfully',
      data: stats,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('alerts/:id/acknowledge')
  async acknowledgeBusinessAlert(@Param('id') id: string): Promise<ApiResponseDto> {
    const success = this.businessAlertsService.acknowledgeAlert(id);
    if (!success) {
      return {
        success: false,
        message: 'Business alert not found',
        data: null,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: true,
      message: 'Business alert acknowledged successfully',
      data: null,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('alerts/:id/resolve')
  async resolveBusinessAlert(@Param('id') id: string): Promise<ApiResponseDto> {
    const success = this.businessAlertsService.resolveAlert(id);
    if (!success) {
      return {
        success: false,
        message: 'Business alert not found',
        data: null,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: true,
      message: 'Business alert resolved successfully',
      data: null,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('alerts/config')
  async getBusinessAlertConfig(): Promise<ApiResponseDto> {
    const config = this.businessAlertsService.getConfig();
    return {
      success: true,
      message: 'Business alert configuration retrieved successfully',
      data: config,
      timestamp: new Date().toISOString(),
    };
  }

  @Put('alerts/config')
  async updateBusinessAlertConfig(@Body() config: any): Promise<ApiResponseDto> {
    this.businessAlertsService.updateConfig(config);
    return {
      success: true,
      message: 'Business alert configuration updated successfully',
      data: null,
      timestamp: new Date().toISOString(),
    };
  }

  // Health Check

  @Get('health')
  async getAdvancedMonitoringHealth(): Promise<ApiResponseDto> {
    const health = {
      apm: {
        status: 'active',
        transactions: this.apmService.getMetrics().transactions.total,
        errors: this.apmService.getMetrics().errors.total,
      },
      analytics: {
        status: 'active',
        insights: this.businessAnalyticsService.getInsights(10).length,
      },
      performance: {
        status: 'active',
        tests: this.performanceRegressionService.getTests().length,
      },
      cost: {
        status: 'active',
        categories: this.costMonitoringService.getCategories().length,
        budgets: this.costMonitoringService.getBudgets().length,
      },
      alerts: {
        status: 'active',
        rules: this.businessAlertsService.getRules().length,
        activeAlerts: this.businessAlertsService.getAlerts(undefined, undefined, false).length,
      },
    };

    return {
      success: true,
      message: 'Advanced monitoring health check completed',
      data: health,
      timestamp: new Date().toISOString(),
    };
  }
}
