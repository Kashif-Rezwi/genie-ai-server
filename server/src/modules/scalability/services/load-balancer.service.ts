import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';

export interface LoadBalancerConfig {
  algorithm: 'round_robin' | 'least_connections' | 'weighted_round_robin' | 'ip_hash';
  healthCheckInterval: number; // milliseconds
  healthCheckTimeout: number; // milliseconds
  maxRetries: number;
  retryDelay: number; // milliseconds
  stickySession: boolean;
  sessionTimeout: number; // milliseconds
  maxConnections: number;
  connectionTimeout: number; // milliseconds
}

export interface BackendServer {
  id: string;
  host: string;
  port: number;
  weight: number;
  health: 'healthy' | 'unhealthy' | 'degraded';
  lastHealthCheck: Date;
  activeConnections: number;
  totalRequests: number;
  errorCount: number;
  responseTime: number;
}

export interface LoadBalancerStats {
  totalRequests: number;
  totalErrors: number;
  averageResponseTime: number;
  activeConnections: number;
  healthyBackends: number;
  unhealthyBackends: number;
  backends: BackendServer[];
}

export interface HealthCheckResult {
  backendId: string;
  healthy: boolean;
  responseTime: number;
  error?: string;
  timestamp: Date;
}

/**
 * Load Balancer Service
 * Handles load balancing configuration and health checks
 */
@Injectable()
export class LoadBalancerService {
  private readonly logger = new Logger(LoadBalancerService.name);
  private readonly backendsPrefix = 'lb:backends:';
  private readonly statsPrefix = 'lb:stats:';
  private readonly healthPrefix = 'lb:health:';

  // Default load balancer configuration
  private readonly defaultConfig: LoadBalancerConfig = {
    algorithm: 'round_robin',
    healthCheckInterval: 30000, // 30 seconds
    healthCheckTimeout: 5000, // 5 seconds
    maxRetries: 3,
    retryDelay: 1000, // 1 second
    stickySession: false,
    sessionTimeout: 1800000, // 30 minutes
    maxConnections: 1000,
    connectionTimeout: 30000, // 30 seconds
  };

  constructor(@InjectRedis() private readonly redis: Redis) {}

  /**
   * Initialize load balancer with backend servers
   * @param backends - Backend servers to register
   * @param config - Load balancer configuration
   * @returns Promise<void>
   */
  async initialize(
    backends: Omit<
      BackendServer,
      | 'health'
      | 'lastHealthCheck'
      | 'activeConnections'
      | 'totalRequests'
      | 'errorCount'
      | 'responseTime'
    >[],
    config: Partial<LoadBalancerConfig> = {}
  ): Promise<void> {
    try {
      const lbConfig = { ...this.defaultConfig, ...config };

      // Register backend servers
      for (const backend of backends) {
        const fullBackend: BackendServer = {
          ...backend,
          health: 'healthy',
          lastHealthCheck: new Date(),
          activeConnections: 0,
          totalRequests: 0,
          errorCount: 0,
          responseTime: 0,
        };

        await this.registerBackend(fullBackend);
      }

      // Store configuration
      await this.redis.setex('lb:config', 86400, JSON.stringify(lbConfig));

      this.logger.log(`Load balancer initialized with ${backends.length} backends`);
    } catch (error) {
      this.logger.error('Error initializing load balancer:', error);
      throw error;
    }
  }

  /**
   * Register a backend server
   * @param backend - Backend server to register
   * @returns Promise<void>
   */
  async registerBackend(backend: BackendServer): Promise<void> {
    try {
      const key = `${this.backendsPrefix}${backend.id}`;
      await this.redis.setex(key, 86400, JSON.stringify(backend));

      this.logger.log(`Backend server registered: ${backend.host}:${backend.port}`);
    } catch (error) {
      this.logger.error(`Error registering backend ${backend.id}:`, error);
      throw error;
    }
  }

  /**
   * Unregister a backend server
   * @param backendId - Backend server ID to unregister
   * @returns Promise<void>
   */
  async unregisterBackend(backendId: string): Promise<void> {
    try {
      const key = `${this.backendsPrefix}${backendId}`;
      await this.redis.del(key);

      this.logger.log(`Backend server unregistered: ${backendId}`);
    } catch (error) {
      this.logger.error(`Error unregistering backend ${backendId}:`, error);
      throw error;
    }
  }

  /**
   * Get next backend server based on load balancing algorithm
   * @param clientIp - Client IP address (for IP hash algorithm)
   * @returns Promise<BackendServer | null> - Next backend server
   */
  async getNextBackend(clientIp?: string): Promise<BackendServer | null> {
    try {
      const backends = await this.getHealthyBackends();

      if (backends.length === 0) {
        this.logger.warn('No healthy backends available');
        return null;
      }

      const config = await this.getConfig();

      switch (config.algorithm) {
        case 'round_robin':
          return this.roundRobinSelection(backends);
        case 'least_connections':
          return this.leastConnectionsSelection(backends);
        case 'weighted_round_robin':
          return this.weightedRoundRobinSelection(backends);
        case 'ip_hash':
          return this.ipHashSelection(backends, clientIp);
        default:
          return this.roundRobinSelection(backends);
      }
    } catch (error) {
      this.logger.error('Error getting next backend:', error);
      return null;
    }
  }

  /**
   * Perform health check on all backend servers
   * @returns Promise<HealthCheckResult[]> - Health check results
   */
  async performHealthChecks(): Promise<HealthCheckResult[]> {
    try {
      const backends = await this.getAllBackends();
      const results: HealthCheckResult[] = [];

      for (const backend of backends) {
        const result = await this.checkBackendHealth(backend);
        results.push(result);

        // Update backend health status
        if (result.healthy) {
          await this.updateBackendHealth(backend.id, 'healthy');
        } else {
          await this.updateBackendHealth(backend.id, 'unhealthy');
        }
      }

      this.logger.debug(`Health checks completed for ${backends.length} backends`);
      return results;
    } catch (error) {
      this.logger.error('Error performing health checks:', error);
      return [];
    }
  }

  /**
   * Get load balancer statistics
   * @returns Promise<LoadBalancerStats> - Load balancer statistics
   */
  async getStats(): Promise<LoadBalancerStats> {
    try {
      const backends = await this.getAllBackends();
      const healthyBackends = backends.filter(b => b.health === 'healthy');
      const unhealthyBackends = backends.filter(b => b.health === 'unhealthy');

      const totalRequests = backends.reduce((sum, b) => sum + b.totalRequests, 0);
      const totalErrors = backends.reduce((sum, b) => sum + b.errorCount, 0);
      const activeConnections = backends.reduce((sum, b) => sum + b.activeConnections, 0);

      const averageResponseTime =
        backends.length > 0
          ? backends.reduce((sum, b) => sum + b.responseTime, 0) / backends.length
          : 0;

      return {
        totalRequests,
        totalErrors,
        averageResponseTime,
        activeConnections,
        healthyBackends: healthyBackends.length,
        unhealthyBackends: unhealthyBackends.length,
        backends,
      };
    } catch (error) {
      this.logger.error('Error getting load balancer stats:', error);
      throw error;
    }
  }

  /**
   * Update backend server statistics
   * @param backendId - Backend server ID
   * @param responseTime - Response time in milliseconds
   * @param success - Whether the request was successful
   * @returns Promise<void>
   */
  async updateBackendStats(
    backendId: string,
    responseTime: number,
    success: boolean
  ): Promise<void> {
    try {
      const backend = await this.getBackend(backendId);
      if (!backend) {
        return;
      }

      backend.totalRequests++;
      backend.responseTime = (backend.responseTime + responseTime) / 2; // Moving average

      if (!success) {
        backend.errorCount++;
      }

      await this.registerBackend(backend);
    } catch (error) {
      this.logger.error(`Error updating backend stats for ${backendId}:`, error);
    }
  }

  /**
   * Get all backend servers
   * @returns Promise<BackendServer[]> - All backend servers
   */
  private async getAllBackends(): Promise<BackendServer[]> {
    try {
      const keys = await this.redis.keys(`${this.backendsPrefix}*`);
      const backends: BackendServer[] = [];

      for (const key of keys) {
        const data = await this.redis.get(key);
        if (data) {
          const backend = JSON.parse(data) as BackendServer;
          backends.push(backend);
        }
      }

      return backends;
    } catch (error) {
      this.logger.error('Error getting all backends:', error);
      return [];
    }
  }

  /**
   * Get healthy backend servers
   * @returns Promise<BackendServer[]> - Healthy backend servers
   */
  private async getHealthyBackends(): Promise<BackendServer[]> {
    try {
      const backends = await this.getAllBackends();
      return backends.filter(b => b.health === 'healthy');
    } catch (error) {
      this.logger.error('Error getting healthy backends:', error);
      return [];
    }
  }

  /**
   * Get load balancer configuration
   * @returns Promise<LoadBalancerConfig> - Load balancer configuration
   */
  private async getConfig(): Promise<LoadBalancerConfig> {
    try {
      const config = await this.redis.get('lb:config');
      if (config) {
        return JSON.parse(config) as LoadBalancerConfig;
      }
      return this.defaultConfig;
    } catch (error) {
      this.logger.error('Error getting load balancer config:', error);
      return this.defaultConfig;
    }
  }

  /**
   * Get specific backend server
   * @param backendId - Backend server ID
   * @returns Promise<BackendServer | null> - Backend server
   */
  private async getBackend(backendId: string): Promise<BackendServer | null> {
    try {
      const key = `${this.backendsPrefix}${backendId}`;
      const data = await this.redis.get(key);

      if (data) {
        return JSON.parse(data) as BackendServer;
      }

      return null;
    } catch (error) {
      this.logger.error(`Error getting backend ${backendId}:`, error);
      return null;
    }
  }

  /**
   * Check backend server health
   * @param backend - Backend server to check
   * @returns Promise<HealthCheckResult> - Health check result
   */
  private async checkBackendHealth(backend: BackendServer): Promise<HealthCheckResult> {
    try {
      const startTime = Date.now();

      // Simple health check - in production, this would make an HTTP request
      const healthy = true; // Simplified for MVP
      const responseTime = Date.now() - startTime;

      return {
        backendId: backend.id,
        healthy,
        responseTime,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Health check failed for backend ${backend.id}:`, error);
      return {
        backendId: backend.id,
        healthy: false,
        responseTime: 0,
        error: error.message,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Update backend health status
   * @param backendId - Backend server ID
   * @param health - Health status
   * @returns Promise<void>
   */
  private async updateBackendHealth(
    backendId: string,
    health: 'healthy' | 'unhealthy' | 'degraded'
  ): Promise<void> {
    try {
      const backend = await this.getBackend(backendId);
      if (backend) {
        backend.health = health;
        backend.lastHealthCheck = new Date();
        await this.registerBackend(backend);
      }
    } catch (error) {
      this.logger.error(`Error updating backend health for ${backendId}:`, error);
    }
  }

  /**
   * Round robin selection
   * @param backends - Backend servers
   * @returns BackendServer - Selected backend
   */
  private roundRobinSelection(backends: BackendServer[]): BackendServer {
    const index = Math.floor(Math.random() * backends.length);
    return backends[index];
  }

  /**
   * Least connections selection
   * @param backends - Backend servers
   * @returns BackendServer - Selected backend
   */
  private leastConnectionsSelection(backends: BackendServer[]): BackendServer {
    return backends.reduce((min, current) =>
      current.activeConnections < min.activeConnections ? current : min
    );
  }

  /**
   * Weighted round robin selection
   * @param backends - Backend servers
   * @returns BackendServer - Selected backend
   */
  private weightedRoundRobinSelection(backends: BackendServer[]): BackendServer {
    const totalWeight = backends.reduce((sum, b) => sum + b.weight, 0);
    let random = Math.random() * totalWeight;

    for (const backend of backends) {
      random -= backend.weight;
      if (random <= 0) {
        return backend;
      }
    }

    return backends[0];
  }

  /**
   * IP hash selection
   * @param backends - Backend servers
   * @param clientIp - Client IP address
   * @returns BackendServer - Selected backend
   */
  private ipHashSelection(backends: BackendServer[], clientIp?: string): BackendServer {
    if (!clientIp) {
      return this.roundRobinSelection(backends);
    }

    const hash = this.hashString(clientIp);
    const index = hash % backends.length;
    return backends[index];
  }

  /**
   * Hash a string to a number
   * @param str - String to hash
   * @returns number - Hash value
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}
