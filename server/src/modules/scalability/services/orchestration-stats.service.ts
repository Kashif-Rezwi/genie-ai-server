import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';

export interface DeploymentStatus {
  name: string;
  namespace: string;
  replicas: number;
  readyReplicas: number;
  availableReplicas: number;
  unavailableReplicas: number;
  status: 'Running' | 'Pending' | 'Failed' | 'Unknown';
  age: string;
  image: string;
}

export interface ServiceStatus {
  name: string;
  namespace: string;
  type: string;
  clusterIP: string;
  externalIPs: string[];
  ports: Array<{
    port: number;
    targetPort: number;
    protocol: string;
  }>;
  age: string;
}

export interface OrchestrationStats {
  totalDeployments: number;
  runningDeployments: number;
  failedDeployments: number;
  totalServices: number;
  totalPods: number;
  runningPods: number;
  failedPods: number;
  averageCpuUsage: number;
  averageMemoryUsage: number;
  resourceUtilization: {
    cpu: number;
    memory: number;
    storage: number;
  };
}

@Injectable()
export class OrchestrationStatsService {
  private readonly logger = new Logger(OrchestrationStatsService.name);
  private readonly deploymentsPrefix = 'orchestration:deployments:';
  private readonly servicesPrefix = 'orchestration:services:';
  private readonly podsPrefix = 'orchestration:pods:';
  private readonly statsPrefix = 'orchestration:stats:';

  constructor(@InjectRedis() private readonly redis: Redis) {}

  /**
   * Get orchestration statistics
   * @returns Promise<OrchestrationStats> - Orchestration statistics
   */
  async getStats(): Promise<OrchestrationStats> {
    try {
      const deployments = await this.getAllDeployments();
      const services = await this.getAllServices();

      const totalDeployments = deployments.length;
      const runningDeployments = deployments.filter(d => d.status === 'Running').length;
      const failedDeployments = deployments.filter(d => d.status === 'Failed').length;

      const totalServices = services.length;

      // Calculate pod statistics
      const totalPods = deployments.reduce((sum, d) => sum + d.replicas, 0);
      const runningPods = deployments.reduce((sum, d) => sum + d.readyReplicas, 0);
      const failedPods = deployments.reduce((sum, d) => sum + d.unavailableReplicas, 0);

      // Calculate resource utilization (mock data for now)
      const averageCpuUsage = Math.random() * 100;
      const averageMemoryUsage = Math.random() * 100;

      const stats: OrchestrationStats = {
        totalDeployments,
        runningDeployments,
        failedDeployments,
        totalServices,
        totalPods,
        runningPods,
        failedPods,
        averageCpuUsage,
        averageMemoryUsage,
        resourceUtilization: {
          cpu: averageCpuUsage,
          memory: averageMemoryUsage,
          storage: Math.random() * 100,
        },
      };

      // Cache stats
      await this.redis.setex(
        `${this.statsPrefix}latest`,
        300, // 5 minutes
        JSON.stringify(stats)
      );

      this.logger.log(
        `Orchestration stats calculated: ${totalDeployments} deployments, ${totalServices} services`
      );
      return stats;
    } catch (error) {
      this.logger.error('Error getting orchestration stats:', error);
      throw error;
    }
  }

  /**
   * Get all deployments
   * @returns Promise<DeploymentStatus[]> - All deployments
   */
  async getAllDeployments(): Promise<DeploymentStatus[]> {
    try {
      const keys = await this.redis.keys(`${this.deploymentsPrefix}*`);
      const deployments: DeploymentStatus[] = [];

      for (const key of keys) {
        const data = await this.redis.get(key);
        if (data) {
          deployments.push(JSON.parse(data));
        }
      }

      return deployments;
    } catch (error) {
      this.logger.error('Error getting deployments:', error);
      throw error;
    }
  }

  /**
   * Get all services
   * @returns Promise<ServiceStatus[]> - All services
   */
  async getAllServices(): Promise<ServiceStatus[]> {
    try {
      const keys = await this.redis.keys(`${this.servicesPrefix}*`);
      const services: ServiceStatus[] = [];

      for (const key of keys) {
        const data = await this.redis.get(key);
        if (data) {
          services.push(JSON.parse(data));
        }
      }

      return services;
    } catch (error) {
      this.logger.error('Error getting services:', error);
      throw error;
    }
  }

  /**
   * Get deployment status
   * @param deploymentName - Deployment name
   * @returns Promise<DeploymentStatus | null> - Deployment status
   */
  async getDeploymentStatus(deploymentName: string): Promise<DeploymentStatus | null> {
    try {
      const data = await this.redis.get(`${this.deploymentsPrefix}${deploymentName}`);
      if (!data) {
        return null;
      }

      return JSON.parse(data);
    } catch (error) {
      this.logger.error(`Error getting deployment status for ${deploymentName}:`, error);
      throw error;
    }
  }

  /**
   * Get service status
   * @param serviceName - Service name
   * @returns Promise<ServiceStatus | null> - Service status
   */
  async getServiceStatus(serviceName: string): Promise<ServiceStatus | null> {
    try {
      const data = await this.redis.get(`${this.servicesPrefix}${serviceName}`);
      if (!data) {
        return null;
      }

      return JSON.parse(data);
    } catch (error) {
      this.logger.error(`Error getting service status for ${serviceName}:`, error);
      throw error;
    }
  }

  /**
   * Update deployment status
   * @param deployment - Deployment status
   */
  async updateDeploymentStatus(deployment: DeploymentStatus): Promise<void> {
    try {
      await this.redis.setex(
        `${this.deploymentsPrefix}${deployment.name}`,
        3600, // 1 hour
        JSON.stringify(deployment)
      );

      this.logger.log(`Deployment status updated for ${deployment.name}`);
    } catch (error) {
      this.logger.error(`Error updating deployment status for ${deployment.name}:`, error);
      throw error;
    }
  }

  /**
   * Update service status
   * @param service - Service status
   */
  async updateServiceStatus(service: ServiceStatus): Promise<void> {
    try {
      await this.redis.setex(
        `${this.servicesPrefix}${service.name}`,
        3600, // 1 hour
        JSON.stringify(service)
      );

      this.logger.log(`Service status updated for ${service.name}`);
    } catch (error) {
      this.logger.error(`Error updating service status for ${service.name}:`, error);
      throw error;
    }
  }

  /**
   * Get cached stats
   * @returns Promise<OrchestrationStats | null> - Cached stats
   */
  async getCachedStats(): Promise<OrchestrationStats | null> {
    try {
      const data = await this.redis.get(`${this.statsPrefix}latest`);
      if (!data) {
        return null;
      }

      return JSON.parse(data);
    } catch (error) {
      this.logger.error('Error getting cached stats:', error);
      return null;
    }
  }
}
