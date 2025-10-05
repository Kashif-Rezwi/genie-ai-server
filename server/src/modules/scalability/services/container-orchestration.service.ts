import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { KubernetesConfigService, ContainerConfig, ServiceConfig } from './kubernetes-config.service';
import { DockerConfigService } from './docker-config.service';
import { OrchestrationStatsService, DeploymentStatus, ServiceStatus, OrchestrationStats } from './orchestration-stats.service';

// Re-export interfaces for external use
export { ContainerConfig, ServiceConfig } from './kubernetes-config.service';
export { DeploymentStatus, ServiceStatus, OrchestrationStats } from './orchestration-stats.service';

/**
 * Container Orchestration Service
 * Handles Docker and Kubernetes orchestration
 */
@Injectable()
export class ContainerOrchestrationService {
  private readonly logger = new Logger(ContainerOrchestrationService.name);

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly kubernetesConfigService: KubernetesConfigService,
    private readonly dockerConfigService: DockerConfigService,
    private readonly statsService: OrchestrationStatsService,
  ) {}

  /**
   * Create deployment configuration
   * @param config - Container configuration
   * @returns Promise<string> - Deployment configuration YAML
   */
  async createDeploymentConfig(config: ContainerConfig): Promise<string> {
    return this.kubernetesConfigService.createDeploymentConfig(config);
  }

  /**
   * Create service configuration
   * @param config - Service configuration
   * @returns Promise<string> - Service configuration YAML
   */
  async createServiceConfig(config: ServiceConfig): Promise<string> {
    return this.kubernetesConfigService.createServiceConfig(config);
  }

  /**
   * Generate Docker Compose configuration
   * @param config - Container configuration
   * @returns Promise<string> - Docker Compose YAML
   */
  async generateDockerCompose(config: ContainerConfig): Promise<string> {
    return this.dockerConfigService.generateDockerCompose(config);
  }

  /**
   * Generate Dockerfile for application
   * @param config - Container configuration
   * @returns Promise<string> - Dockerfile content
   */
  async generateDockerfile(config: ContainerConfig): Promise<string> {
    return this.dockerConfigService.generateDockerfile(config);
  }

  /**
   * Generate .dockerignore file
   * @returns Promise<string> - .dockerignore content
   */
  async generateDockerIgnore(): Promise<string> {
    return this.dockerConfigService.generateDockerIgnore();
  }

  /**
   * Scale deployment
   * @param deploymentName - Deployment name
   * @param replicas - Number of replicas
   * @returns Promise<boolean> - Success status
   */
  async scaleDeployment(deploymentName: string, replicas: number): Promise<boolean> {
    try {
      const deployment = await this.statsService.getDeploymentStatus(deploymentName);
      if (!deployment) {
        this.logger.warn(`Deployment ${deploymentName} not found`);
        return false;
      }

      // Update replica count
      deployment.replicas = replicas;
      deployment.readyReplicas = Math.min(replicas, deployment.readyReplicas);
      deployment.availableReplicas = Math.min(replicas, deployment.availableReplicas);
      deployment.unavailableReplicas = Math.max(0, replicas - deployment.availableReplicas);

      // Update status
      await this.statsService.updateDeploymentStatus(deployment);

      this.logger.log(`Deployment ${deploymentName} scaled to ${replicas} replicas`);
      return true;
    } catch (error) {
      this.logger.error(`Error scaling deployment ${deploymentName}:`, error);
      return false;
    }
  }

  /**
   * Get deployment status
   * @param deploymentName - Deployment name
   * @returns Promise<DeploymentStatus | null> - Deployment status
   */
  async getDeploymentStatus(deploymentName: string): Promise<DeploymentStatus | null> {
    return this.statsService.getDeploymentStatus(deploymentName);
  }

  /**
   * Get service status
   * @param serviceName - Service name
   * @returns Promise<ServiceStatus | null> - Service status
   */
  async getServiceStatus(serviceName: string): Promise<ServiceStatus | null> {
    return this.statsService.getServiceStatus(serviceName);
  }

  /**
   * Get all deployments
   * @returns Promise<DeploymentStatus[]> - All deployments
   */
  async getAllDeployments(): Promise<DeploymentStatus[]> {
    return this.statsService.getAllDeployments();
  }

  /**
   * Get all services
   * @returns Promise<ServiceStatus[]> - All services
   */
  async getAllServices(): Promise<ServiceStatus[]> {
    return this.statsService.getAllServices();
  }

  /**
   * Get orchestration statistics
   * @returns Promise<OrchestrationStats> - Orchestration statistics
   */
  async getStats(): Promise<OrchestrationStats> {
    return this.statsService.getStats();
  }

  /**
   * Get cached statistics
   * @returns Promise<OrchestrationStats | null> - Cached statistics
   */
  async getCachedStats(): Promise<OrchestrationStats | null> {
    return this.statsService.getCachedStats();
  }

  /**
   * Update deployment status
   * @param deployment - Deployment status
   */
  async updateDeploymentStatus(deployment: DeploymentStatus): Promise<void> {
    return this.statsService.updateDeploymentStatus(deployment);
  }

  /**
   * Update service status
   * @param service - Service status
   */
  async updateServiceStatus(service: ServiceStatus): Promise<void> {
    return this.statsService.updateServiceStatus(service);
  }
}