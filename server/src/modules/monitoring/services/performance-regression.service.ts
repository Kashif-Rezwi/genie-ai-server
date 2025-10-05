import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
import { LoggingService } from './logging.service';
import { APMService } from './apm.service';

export interface PerformanceTest {
  id: string;
  name: string;
  description: string;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
  expectedResponseTime: number;
  expectedStatus: number;
  timeout: number;
  retries: number;
  enabled: boolean;
  createdAt: number;
  lastRun?: number;
  lastResult?: PerformanceTestResult;
}

export interface PerformanceTestResult {
  testId: string;
  timestamp: number;
  success: boolean;
  responseTime: number;
  statusCode: number;
  error?: string;
  metrics: {
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
    responseTime: number;
    throughput: number;
  };
  regression?: {
    detected: boolean;
    severity: 'low' | 'medium' | 'high' | 'critical';
    responseTimeIncrease: number;
    responseTimeIncreasePercent: number;
    previousResponseTime: number;
  };
}

export interface PerformanceBaseline {
  testId: string;
  baselineResponseTime: number;
  baselineThroughput: number;
  baselineMemoryUsage: number;
  baselineCpuUsage: number;
  sampleSize: number;
  createdAt: number;
  updatedAt: number;
}

export interface PerformanceReport {
  testId: string;
  testName: string;
  period: {
    start: number;
    end: number;
  };
  summary: {
    totalRuns: number;
    successfulRuns: number;
    failedRuns: number;
    averageResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    regressionsDetected: number;
  };
  trends: {
    responseTime: PerformanceTrend[];
    throughput: PerformanceTrend[];
    errorRate: PerformanceTrend[];
  };
  regressions: PerformanceTestResult[];
  recommendations: string[];
}

export interface PerformanceTrend {
  timestamp: number;
  value: number;
  change: number;
  changePercent: number;
}

@Injectable()
export class PerformanceRegressionService {
  private readonly logger = new Logger(PerformanceRegressionService.name);
  private readonly tests = new Map<string, PerformanceTest>();
  private readonly results: PerformanceTestResult[] = [];
  private readonly baselines = new Map<string, PerformanceBaseline>();
  private readonly maxResults = 10000;

  constructor(
    private readonly redisService: RedisService,
    private readonly loggingService: LoggingService,
    private readonly apmService: APMService
  ) {}

  /**
   * Create a new performance test
   */
  createTest(test: Omit<PerformanceTest, 'id' | 'createdAt'>): string {
    const id = this.generateId();
    const newTest: PerformanceTest = {
      ...test,
      id,
      createdAt: Date.now(),
    };

    this.tests.set(id, newTest);
    this.loggingService.log(`Performance test created: ${test.name}`, 'monitoring');

    return id;
  }

  /**
   * Update an existing performance test
   */
  updateTest(testId: string, updates: Partial<PerformanceTest>): boolean {
    const test = this.tests.get(testId);
    if (!test) {
      this.logger.warn(`Test ${testId} not found`);
      return false;
    }

    const updatedTest = { ...test, ...updates };
    this.tests.set(testId, updatedTest);

    this.loggingService.log(`Performance test updated: ${test.name}`, 'monitoring');

    return true;
  }

  /**
   * Delete a performance test
   */
  deleteTest(testId: string): boolean {
    const test = this.tests.get(testId);
    if (!test) {
      this.logger.warn(`Test ${testId} not found`);
      return false;
    }

    this.tests.delete(testId);
    this.baselines.delete(testId);

    this.loggingService.log(`Performance test deleted: ${test.name}`, 'monitoring');

    return true;
  }

  /**
   * Get all performance tests
   */
  getTests(): PerformanceTest[] {
    return Array.from(this.tests.values());
  }

  /**
   * Get a specific performance test
   */
  getTest(testId: string): PerformanceTest | null {
    return this.tests.get(testId) || null;
  }

  /**
   * Run a performance test
   */
  async runTest(testId: string): Promise<PerformanceTestResult> {
    const test = this.tests.get(testId);
    if (!test) {
      throw new Error(`Test ${testId} not found`);
    }

    if (!test.enabled) {
      throw new Error(`Test ${testId} is disabled`);
    }

    const startTime = Date.now();
    const startMemory = process.memoryUsage();
    const startCpu = process.cpuUsage();

    let result: PerformanceTestResult;
    const transactionId = this.apmService.startTransaction(
      `Performance Test: ${test.name}`,
      'custom',
      undefined,
      { testId, endpoint: test.endpoint }
    );

    try {
      const response = await this.executeRequest(test);
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      const endMemory = process.memoryUsage();
      const endCpu = process.cpuUsage();

      result = {
        testId,
        timestamp: startTime,
        success:
          response.statusCode === test.expectedStatus && responseTime <= test.expectedResponseTime,
        responseTime,
        statusCode: response.statusCode,
        metrics: {
          memoryUsage: endMemory,
          cpuUsage: endCpu,
          responseTime,
          throughput: 1000 / responseTime, // requests per second
        },
      };

      // Check for regression
      const regression = await this.checkRegression(testId, result);
      if (regression) {
        result.regression = regression;
      }

      this.apmService.endTransaction(transactionId, 'completed', {
        responseTime,
        statusCode: response.statusCode,
        regression: !!regression,
      });
    } catch (error) {
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      result = {
        testId,
        timestamp: startTime,
        success: false,
        responseTime,
        statusCode: 0,
        error: error.message,
        metrics: {
          memoryUsage: process.memoryUsage(),
          cpuUsage: process.cpuUsage(),
          responseTime,
          throughput: 0,
        },
      };

      this.apmService.endTransaction(transactionId, 'failed', {
        error: error.message,
        responseTime,
      });
    }

    // Store result
    this.results.push(result);
    if (this.results.length > this.maxResults) {
      this.results.splice(0, this.results.length - this.maxResults);
    }

    // Update test last run
    test.lastRun = startTime;
    test.lastResult = result;

    this.loggingService.log(
      `Performance test completed: ${test.name} - ${result.success ? 'PASS' : 'FAIL'} (${result.responseTime}ms)`,
      'monitoring'
    );

    return result;
  }

  /**
   * Run all enabled performance tests
   */
  async runAllTests(): Promise<PerformanceTestResult[]> {
    const enabledTests = Array.from(this.tests.values()).filter(test => test.enabled);
    const results: PerformanceTestResult[] = [];

    this.logger.log(`Running ${enabledTests.length} performance tests`);

    for (const test of enabledTests) {
      try {
        const result = await this.runTest(test.id);
        results.push(result);
      } catch (error) {
        this.logger.error(`Failed to run test ${test.id}: ${error.message}`);
      }
    }

    this.logger.log(`Completed ${results.length} performance tests`);
    return results;
  }

  /**
   * Get performance test results
   */
  getResults(testId?: string, limit = 100): PerformanceTestResult[] {
    let filteredResults = this.results;

    if (testId) {
      filteredResults = this.results.filter(result => result.testId === testId);
    }

    return filteredResults.slice(-limit);
  }

  /**
   * Get performance report for a test
   */
  getPerformanceReport(testId: string, days = 7): PerformanceReport | null {
    const test = this.tests.get(testId);
    if (!test) {
      return null;
    }

    const endTime = Date.now();
    const startTime = endTime - days * 24 * 60 * 60 * 1000;

    const testResults = this.results.filter(
      result => result.testId === testId && result.timestamp >= startTime
    );

    if (testResults.length === 0) {
      return null;
    }

    const successfulRuns = testResults.filter(result => result.success);
    const failedRuns = testResults.filter(result => !result.success);
    const responseTimes = successfulRuns.map(result => result.responseTime).sort((a, b) => a - b);

    const regressions = testResults.filter(result => result.regression?.detected);

    return {
      testId,
      testName: test.name,
      period: { start: startTime, end: endTime },
      summary: {
        totalRuns: testResults.length,
        successfulRuns: successfulRuns.length,
        failedRuns: failedRuns.length,
        averageResponseTime: this.calculateAverage(responseTimes),
        p95ResponseTime: this.calculatePercentile(responseTimes, 95),
        p99ResponseTime: this.calculatePercentile(responseTimes, 99),
        regressionsDetected: regressions.length,
      },
      trends: {
        responseTime: this.calculateTrends(testResults, 'responseTime'),
        throughput: this.calculateTrends(testResults, 'metrics.throughput'),
        errorRate: this.calculateErrorRateTrends(testResults),
      },
      regressions,
      recommendations: this.generateRecommendations(testResults, regressions),
    };
  }

  /**
   * Set performance baseline for a test
   */
  setBaseline(testId: string, sampleSize = 10): boolean {
    const test = this.tests.get(testId);
    if (!test) {
      this.logger.warn(`Test ${testId} not found`);
      return false;
    }

    const testResults = this.results
      .filter(result => result.testId === testId && result.success)
      .slice(-sampleSize);

    if (testResults.length < 5) {
      this.logger.warn(`Not enough successful results for baseline (${testResults.length})`);
      return false;
    }

    const responseTimes = testResults.map(result => result.responseTime);
    const throughputs = testResults.map(result => result.metrics.throughput);
    const memoryUsages = testResults.map(result => result.metrics.memoryUsage.heapUsed);
    const cpuUsages = testResults.map(
      result => result.metrics.cpuUsage.user + result.metrics.cpuUsage.system
    );

    const baseline: PerformanceBaseline = {
      testId,
      baselineResponseTime: this.calculateAverage(responseTimes),
      baselineThroughput: this.calculateAverage(throughputs),
      baselineMemoryUsage: this.calculateAverage(memoryUsages),
      baselineCpuUsage: this.calculateAverage(cpuUsages),
      sampleSize: testResults.length,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.baselines.set(testId, baseline);

    this.loggingService.log(`Performance baseline set for test: ${test.name}`, 'monitoring');

    return true;
  }

  /**
   * Get performance baseline for a test
   */
  getBaseline(testId: string): PerformanceBaseline | null {
    return this.baselines.get(testId) || null;
  }

  /**
   * Clear old test results
   */
  clearOldResults(olderThanDays = 30): void {
    const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
    const oldCount = this.results.length;

    this.results.splice(
      0,
      this.results.findIndex(result => result.timestamp >= cutoff)
    );

    this.logger.log(`Cleared ${oldCount - this.results.length} old performance test results`);
  }

  private async executeRequest(test: PerformanceTest): Promise<{ statusCode: number; body: any }> {
    const url = test.endpoint.startsWith('http')
      ? test.endpoint
      : `http://localhost:3000${test.endpoint}`;

    const options: RequestInit = {
      method: test.method,
      headers: {
        'Content-Type': 'application/json',
        ...test.headers,
      },
    };

    if (test.body && (test.method === 'POST' || test.method === 'PUT')) {
      options.body = JSON.stringify(test.body);
    }

    const response = await fetch(url, options);
    const body = await response.text();

    return {
      statusCode: response.status,
      body: body ? JSON.parse(body) : null,
    };
  }

  private async checkRegression(
    testId: string,
    result: PerformanceTestResult
  ): Promise<PerformanceTestResult['regression'] | null> {
    const baseline = this.baselines.get(testId);
    if (!baseline) {
      return null;
    }

    const responseTimeIncrease = result.responseTime - baseline.baselineResponseTime;
    const responseTimeIncreasePercent =
      (responseTimeIncrease / baseline.baselineResponseTime) * 100;

    // Consider regression if response time increased by more than 20%
    if (responseTimeIncreasePercent > 20) {
      let severity: 'low' | 'medium' | 'high' | 'critical';
      if (responseTimeIncreasePercent > 100) {
        severity = 'critical';
      } else if (responseTimeIncreasePercent > 50) {
        severity = 'high';
      } else if (responseTimeIncreasePercent > 30) {
        severity = 'medium';
      } else {
        severity = 'low';
      }

      return {
        detected: true,
        severity,
        responseTimeIncrease,
        responseTimeIncreasePercent,
        previousResponseTime: baseline.baselineResponseTime,
      };
    }

    return null;
  }

  private calculateTrends(results: PerformanceTestResult[], metric: string): PerformanceTrend[] {
    const sortedResults = results.sort((a, b) => a.timestamp - b.timestamp);
    const trends: PerformanceTrend[] = [];

    for (let i = 1; i < sortedResults.length; i++) {
      const current = this.getNestedValue(sortedResults[i], metric);
      const previous = this.getNestedValue(sortedResults[i - 1], metric);

      if (current !== undefined && previous !== undefined) {
        const change = current - previous;
        const changePercent = previous > 0 ? (change / previous) * 100 : 0;

        trends.push({
          timestamp: sortedResults[i].timestamp,
          value: current,
          change,
          changePercent,
        });
      }
    }

    return trends;
  }

  private calculateErrorRateTrends(results: PerformanceTestResult[]): PerformanceTrend[] {
    const sortedResults = results.sort((a, b) => a.timestamp - b.timestamp);
    const trends: PerformanceTrend[] = [];

    for (let i = 1; i < sortedResults.length; i++) {
      const current = sortedResults[i].success ? 0 : 1;
      const previous = sortedResults[i - 1].success ? 0 : 1;

      const change = current - previous;
      const changePercent = previous > 0 ? (change / previous) * 100 : 0;

      trends.push({
        timestamp: sortedResults[i].timestamp,
        value: current,
        change,
        changePercent,
      });
    }

    return trends;
  }

  private generateRecommendations(
    results: PerformanceTestResult[],
    regressions: PerformanceTestResult[]
  ): string[] {
    const recommendations: string[] = [];

    if (regressions.length > 0) {
      recommendations.push('Investigate performance regressions immediately');
      recommendations.push('Review recent code changes that might affect performance');
    }

    const errorRate = results.filter(r => !r.success).length / results.length;
    if (errorRate > 0.1) {
      recommendations.push('High error rate detected - review test stability');
    }

    const avgResponseTime = this.calculateAverage(results.map(r => r.responseTime));
    if (avgResponseTime > 5000) {
      recommendations.push('Consider optimizing slow endpoints');
    }

    return recommendations;
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
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

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
