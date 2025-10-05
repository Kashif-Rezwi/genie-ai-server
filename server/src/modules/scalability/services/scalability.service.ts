import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { User } from '../../../entities';
import { IUserRepository } from '../../../core/repositories/interfaces';

export interface ScalingMetrics {
  cpuUsage: number;
  memoryUsage: number;
  activeConnections: number;
  requestRate: number;
  errorRate: number;
  responseTime: number;
  queueLength: number;
  timestamp: Date;
}

export interface ScalingThresholds {
  cpu: {
    scaleUp: number;
    scaleDown: number;
  };
  memory: {
    scaleUp: number;
    scaleDown: number;
  };
  connections: {
    scaleUp: number;
    scaleDown: number;
  };
  requestRate: {
    scaleUp: number;
    scaleDown: number;
  };
  errorRate: {
    scaleUp: number;
    scaleDown: number;
  };
  responseTime: {
    scaleUp: number;
    scaleDown: number;
  };
}

export interface ScalingDecision {
  action: 'scale_up' | 'scale_down' | 'no_action';
  reason: string;
  confidence: number;
  metrics: ScalingMetrics;
  recommendedInstances: number;
  currentInstances: number;
}

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  checks: {
    database: boolean;
    redis: boolean;
    memory: boolean;
    cpu: boolean;
    disk: boolean;
    network: boolean;
  };
  metrics: {
    uptime: number;
    memoryUsage: number;
    cpuUsage: number;
    diskUsage: number;
    activeConnections: number;
  };
  timestamp: Date;
}

/**
 * Scalability Service
 * Handles horizontal scaling, load balancing, and auto-scaling
 */
@Injectable()
export class ScalabilityService {
  private readonly logger = new Logger(ScalabilityService.name);
  private readonly metricsPrefix = 'scaling:metrics:';
  private readonly decisionsPrefix = 'scaling:decisions:';
  private readonly healthPrefix = 'scaling:health:';

  // Default scaling thresholds
  private readonly defaultThresholds: ScalingThresholds = {
    cpu: {
      scaleUp: 70, // Scale up when CPU > 70%
      scaleDown: 30, // Scale down when CPU < 30%
    },
    memory: {
      scaleUp: 80, // Scale up when memory > 80%
      scaleDown: 40, // Scale down when memory < 40%
    },
    connections: {
      scaleUp: 1000, // Scale up when connections > 1000
      scaleDown: 200, // Scale down when connections < 200
    },
    requestRate: {
      scaleUp: 1000, // Scale up when requests/sec > 1000
      scaleDown: 100, // Scale down when requests/sec < 100
    },
    errorRate: {
      scaleUp: 5, // Scale up when error rate > 5%
      scaleDown: 1, // Scale down when error rate < 1%
    },
    responseTime: {
      scaleUp: 500, // Scale up when response time > 500ms
      scaleDown: 100, // Scale down when response time < 100ms
    },
  };

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly userRepository: IUserRepository
  ) {}

  /**
   * Collect current scaling metrics
   * @returns Promise<ScalingMetrics> - Current metrics
   */
  async collectMetrics(): Promise<ScalingMetrics> {
    try {
      const startTime = Date.now();

      // Get system metrics
      const memoryUsage = await this.getMemoryUsage();
      const cpuUsage = await this.getCpuUsage();
      const activeConnections = await this.getActiveConnections();
      const requestRate = await this.getRequestRate();
      const errorRate = await this.getErrorRate();
      const responseTime = await this.getAverageResponseTime();
      const queueLength = await this.getQueueLength();

      const metrics: ScalingMetrics = {
        cpuUsage,
        memoryUsage,
        activeConnections,
        requestRate,
        errorRate,
        responseTime,
        queueLength,
        timestamp: new Date(),
      };

      // Store metrics in Redis
      await this.storeMetrics(metrics);

      this.logger.debug(`Metrics collected in ${Date.now() - startTime}ms`, metrics);
      return metrics;
    } catch (error) {
      this.logger.error('Error collecting metrics:', error);
      throw error;
    }
  }

  /**
   * Make scaling decision based on current metrics
   * @param thresholds - Scaling thresholds
   * @returns Promise<ScalingDecision> - Scaling decision
   */
  async makeScalingDecision(
    thresholds: ScalingThresholds = this.defaultThresholds
  ): Promise<ScalingDecision> {
    try {
      const metrics = await this.collectMetrics();
      const currentInstances = await this.getCurrentInstanceCount();

      let action: 'scale_up' | 'scale_down' | 'no_action' = 'no_action';
      let reason = 'All metrics within normal range';
      let confidence = 0;
      let recommendedInstances = currentInstances;

      // Check each metric for scaling triggers
      const triggers = [];

      // CPU scaling
      if (metrics.cpuUsage > thresholds.cpu.scaleUp) {
        triggers.push(`CPU usage ${metrics.cpuUsage}% > ${thresholds.cpu.scaleUp}%`);
        action = 'scale_up';
        confidence += 0.3;
      } else if (metrics.cpuUsage < thresholds.cpu.scaleDown) {
        triggers.push(`CPU usage ${metrics.cpuUsage}% < ${thresholds.cpu.scaleDown}%`);
        if (action === 'no_action') {
          action = 'scale_down';
          confidence += 0.2;
        }
      }

      // Memory scaling
      if (metrics.memoryUsage > thresholds.memory.scaleUp) {
        triggers.push(`Memory usage ${metrics.memoryUsage}% > ${thresholds.memory.scaleUp}%`);
        action = 'scale_up';
        confidence += 0.3;
      } else if (metrics.memoryUsage < thresholds.memory.scaleDown) {
        triggers.push(`Memory usage ${metrics.memoryUsage}% < ${thresholds.memory.scaleDown}%`);
        if (action === 'no_action') {
          action = 'scale_down';
          confidence += 0.2;
        }
      }

      // Connection scaling
      if (metrics.activeConnections > thresholds.connections.scaleUp) {
        triggers.push(
          `Active connections ${metrics.activeConnections} > ${thresholds.connections.scaleUp}`
        );
        action = 'scale_up';
        confidence += 0.2;
      } else if (metrics.activeConnections < thresholds.connections.scaleDown) {
        triggers.push(
          `Active connections ${metrics.activeConnections} < ${thresholds.connections.scaleDown}`
        );
        if (action === 'no_action') {
          action = 'scale_down';
          confidence += 0.1;
        }
      }

      // Request rate scaling
      if (metrics.requestRate > thresholds.requestRate.scaleUp) {
        triggers.push(
          `Request rate ${metrics.requestRate}/s > ${thresholds.requestRate.scaleUp}/s`
        );
        action = 'scale_up';
        confidence += 0.2;
      } else if (metrics.requestRate < thresholds.requestRate.scaleDown) {
        triggers.push(
          `Request rate ${metrics.requestRate}/s < ${thresholds.requestRate.scaleDown}/s`
        );
        if (action === 'no_action') {
          action = 'scale_down';
          confidence += 0.1;
        }
      }

      // Error rate scaling
      if (metrics.errorRate > thresholds.errorRate.scaleUp) {
        triggers.push(`Error rate ${metrics.errorRate}% > ${thresholds.errorRate.scaleUp}%`);
        action = 'scale_up';
        confidence += 0.3;
      }

      // Response time scaling
      if (metrics.responseTime > thresholds.responseTime.scaleUp) {
        triggers.push(
          `Response time ${metrics.responseTime}ms > ${thresholds.responseTime.scaleUp}ms`
        );
        action = 'scale_up';
        confidence += 0.2;
      } else if (metrics.responseTime < thresholds.responseTime.scaleDown) {
        triggers.push(
          `Response time ${metrics.responseTime}ms < ${thresholds.responseTime.scaleDown}ms`
        );
        if (action === 'no_action') {
          action = 'scale_down';
          confidence += 0.1;
        }
      }

      // Calculate recommended instances
      if (action === 'scale_up') {
        recommendedInstances = Math.min(currentInstances * 2, 10); // Max 10 instances
        reason = triggers.join(', ');
      } else if (action === 'scale_down') {
        recommendedInstances = Math.max(currentInstances - 1, 1); // Min 1 instance
        reason = triggers.join(', ');
      }

      const decision: ScalingDecision = {
        action,
        reason,
        confidence: Math.min(confidence, 1),
        metrics,
        recommendedInstances,
        currentInstances,
      };

      // Store decision
      await this.storeScalingDecision(decision);

      this.logger.log(`Scaling decision: ${action} (confidence: ${confidence})`, {
        reason,
        currentInstances,
        recommendedInstances,
      });

      return decision;
    } catch (error) {
      this.logger.error('Error making scaling decision:', error);
      throw error;
    }
  }

  /**
   * Perform health check
   * @returns Promise<HealthCheckResult> - Health check result
   */
  async performHealthCheck(): Promise<HealthCheckResult> {
    try {
      const startTime = Date.now();

      // Check database
      const database = await this.checkDatabase();

      // Check Redis
      const redis = await this.checkRedis();

      // Check memory
      const memory = await this.checkMemory();

      // Check CPU
      const cpu = await this.checkCpu();

      // Check disk
      const disk = await this.checkDisk();

      // Check network
      const network = await this.checkNetwork();

      const checks = {
        database,
        redis,
        memory,
        cpu,
        disk,
        network,
      };

      // Determine overall status
      const failedChecks = Object.values(checks).filter(check => !check).length;
      let status: 'healthy' | 'unhealthy' | 'degraded';

      if (failedChecks === 0) {
        status = 'healthy';
      } else if (failedChecks <= 2) {
        status = 'degraded';
      } else {
        status = 'unhealthy';
      }

      // Get metrics
      const metrics = {
        uptime: process.uptime(),
        memoryUsage: await this.getMemoryUsage(),
        cpuUsage: await this.getCpuUsage(),
        diskUsage: await this.getDiskUsage(),
        activeConnections: await this.getActiveConnections(),
      };

      const result: HealthCheckResult = {
        status,
        checks,
        metrics,
        timestamp: new Date(),
      };

      // Store health check result
      await this.storeHealthCheck(result);

      this.logger.debug(`Health check completed in ${Date.now() - startTime}ms`, {
        status,
        failedChecks,
      });

      return result;
    } catch (error) {
      this.logger.error('Error performing health check:', error);
      throw error;
    }
  }

  /**
   * Get scaling history
   * @param limit - Number of records to return
   * @returns Promise<ScalingDecision[]> - Scaling history
   */
  async getScalingHistory(limit: number = 50): Promise<ScalingDecision[]> {
    try {
      const key = `${this.decisionsPrefix}*`;
      const keys = await this.redis.keys(key);

      if (keys.length === 0) {
        return [];
      }

      // Sort by timestamp (newest first)
      keys.sort((a, b) => b.localeCompare(a));

      const limitedKeys = keys.slice(0, limit);
      const decisions: ScalingDecision[] = [];

      for (const key of limitedKeys) {
        const data = await this.redis.get(key);
        if (data) {
          const decision = JSON.parse(data) as ScalingDecision;
          decisions.push(decision);
        }
      }

      return decisions;
    } catch (error) {
      this.logger.error('Error getting scaling history:', error);
      return [];
    }
  }

  /**
   * Get current instance count
   * @returns Promise<number> - Current instance count
   */
  private async getCurrentInstanceCount(): Promise<number> {
    try {
      // In a real implementation, this would query your orchestration platform
      // For now, we'll use a simple Redis counter
      const count = await this.redis.get('scaling:instance_count');
      return count ? parseInt(count) : 1;
    } catch (error) {
      this.logger.error('Error getting instance count:', error);
      return 1;
    }
  }

  /**
   * Get memory usage percentage
   * @returns Promise<number> - Memory usage percentage
   */
  private async getMemoryUsage(): Promise<number> {
    try {
      const memUsage = process.memoryUsage();
      const totalMem = require('os').totalmem();
      return (memUsage.heapUsed / totalMem) * 100;
    } catch (error) {
      this.logger.error('Error getting memory usage:', error);
      return 0;
    }
  }

  /**
   * Get CPU usage percentage
   * @returns Promise<number> - CPU usage percentage
   */
  private async getCpuUsage(): Promise<number> {
    try {
      // Simple CPU usage calculation
      const startUsage = process.cpuUsage();
      await new Promise(resolve => setTimeout(resolve, 100));
      const endUsage = process.cpuUsage(startUsage);

      const totalUsage = (endUsage.user + endUsage.system) / 1000000; // Convert to seconds
      return Math.min(totalUsage * 100, 100);
    } catch (error) {
      this.logger.error('Error getting CPU usage:', error);
      return 0;
    }
  }

  /**
   * Get active connections count
   * @returns Promise<number> - Active connections count
   */
  private async getActiveConnections(): Promise<number> {
    try {
      // In a real implementation, this would query your load balancer
      // For now, we'll use a Redis counter
      const count = await this.redis.get('scaling:active_connections');
      return count ? parseInt(count) : 0;
    } catch (error) {
      this.logger.error('Error getting active connections:', error);
      return 0;
    }
  }

  /**
   * Get request rate (requests per second)
   * @returns Promise<number> - Request rate
   */
  private async getRequestRate(): Promise<number> {
    try {
      const key = 'scaling:request_rate';
      const count = await this.redis.get(key);
      return count ? parseInt(count) : 0;
    } catch (error) {
      this.logger.error('Error getting request rate:', error);
      return 0;
    }
  }

  /**
   * Get error rate percentage
   * @returns Promise<number> - Error rate percentage
   */
  private async getErrorRate(): Promise<number> {
    try {
      const totalRequests = await this.redis.get('scaling:total_requests');
      const errorRequests = await this.redis.get('scaling:error_requests');

      if (!totalRequests || !errorRequests) {
        return 0;
      }

      const total = parseInt(totalRequests);
      const errors = parseInt(errorRequests);

      return total > 0 ? (errors / total) * 100 : 0;
    } catch (error) {
      this.logger.error('Error getting error rate:', error);
      return 0;
    }
  }

  /**
   * Get average response time
   * @returns Promise<number> - Average response time in milliseconds
   */
  private async getAverageResponseTime(): Promise<number> {
    try {
      const key = 'scaling:avg_response_time';
      const time = await this.redis.get(key);
      return time ? parseFloat(time) : 0;
    } catch (error) {
      this.logger.error('Error getting average response time:', error);
      return 0;
    }
  }

  /**
   * Get queue length
   * @returns Promise<number> - Queue length
   */
  private async getQueueLength(): Promise<number> {
    try {
      const key = 'scaling:queue_length';
      const length = await this.redis.get(key);
      return length ? parseInt(length) : 0;
    } catch (error) {
      this.logger.error('Error getting queue length:', error);
      return 0;
    }
  }

  /**
   * Get disk usage percentage
   * @returns Promise<number> - Disk usage percentage
   */
  private async getDiskUsage(): Promise<number> {
    try {
      const fs = require('fs');
      const stats = fs.statSync('.');
      // Simplified disk usage calculation
      return 0; // In production, use a proper disk usage library
    } catch (error) {
      this.logger.error('Error getting disk usage:', error);
      return 0;
    }
  }

  /**
   * Check database health
   * @returns Promise<boolean> - Database health status
   */
  private async checkDatabase(): Promise<boolean> {
    try {
      await this.userRepository.count();
      return true;
    } catch (error) {
      this.logger.error('Database health check failed:', error);
      return false;
    }
  }

  /**
   * Check Redis health
   * @returns Promise<boolean> - Redis health status
   */
  private async checkRedis(): Promise<boolean> {
    try {
      await this.redis.ping();
      return true;
    } catch (error) {
      this.logger.error('Redis health check failed:', error);
      return false;
    }
  }

  /**
   * Check memory health
   * @returns Promise<boolean> - Memory health status
   */
  private async checkMemory(): Promise<boolean> {
    try {
      const usage = await this.getMemoryUsage();
      return usage < 90; // Consider unhealthy if memory > 90%
    } catch (error) {
      this.logger.error('Memory health check failed:', error);
      return false;
    }
  }

  /**
   * Check CPU health
   * @returns Promise<boolean> - CPU health status
   */
  private async checkCpu(): Promise<boolean> {
    try {
      const usage = await this.getCpuUsage();
      return usage < 90; // Consider unhealthy if CPU > 90%
    } catch (error) {
      this.logger.error('CPU health check failed:', error);
      return false;
    }
  }

  /**
   * Check disk health
   * @returns Promise<boolean> - Disk health status
   */
  private async checkDisk(): Promise<boolean> {
    try {
      const usage = await this.getDiskUsage();
      return usage < 90; // Consider unhealthy if disk > 90%
    } catch (error) {
      this.logger.error('Disk health check failed:', error);
      return false;
    }
  }

  /**
   * Check network health
   * @returns Promise<boolean> - Network health status
   */
  private async checkNetwork(): Promise<boolean> {
    try {
      // Simple network check - ping Redis
      await this.redis.ping();
      return true;
    } catch (error) {
      this.logger.error('Network health check failed:', error);
      return false;
    }
  }

  /**
   * Store metrics in Redis
   * @param metrics - Metrics to store
   * @returns Promise<void>
   */
  private async storeMetrics(metrics: ScalingMetrics): Promise<void> {
    try {
      const key = `${this.metricsPrefix}${Date.now()}`;
      await this.redis.setex(key, 3600, JSON.stringify(metrics)); // 1 hour TTL
    } catch (error) {
      this.logger.error('Error storing metrics:', error);
    }
  }

  /**
   * Store scaling decision in Redis
   * @param decision - Scaling decision to store
   * @returns Promise<void>
   */
  private async storeScalingDecision(decision: ScalingDecision): Promise<void> {
    try {
      const key = `${this.decisionsPrefix}${Date.now()}`;
      await this.redis.setex(key, 86400, JSON.stringify(decision)); // 24 hours TTL
    } catch (error) {
      this.logger.error('Error storing scaling decision:', error);
    }
  }

  /**
   * Store health check result in Redis
   * @param result - Health check result to store
   * @returns Promise<void>
   */
  private async storeHealthCheck(result: HealthCheckResult): Promise<void> {
    try {
      const key = `${this.healthPrefix}${Date.now()}`;
      await this.redis.setex(key, 3600, JSON.stringify(result)); // 1 hour TTL
    } catch (error) {
      this.logger.error('Error storing health check:', error);
    }
  }
}
