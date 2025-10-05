import { Injectable, Logger } from '@nestjs/common';

export interface ContainerConfig {
  image: string;
  tag: string;
  replicas: number;
  cpu: {
    requests: string;
    limits: string;
  };
  memory: {
    requests: string;
    limits: string;
  };
  ports: Array<{
    containerPort: number;
    servicePort: number;
    protocol: 'TCP' | 'UDP';
  }>;
  environment: Record<string, string>;
  healthCheck: {
    path: string;
    port: number;
    initialDelaySeconds: number;
    periodSeconds: number;
    timeoutSeconds: number;
    failureThreshold: number;
  };
  resources: {
    requests: Record<string, string>;
    limits: Record<string, string>;
  };
}

export interface ServiceConfig {
  name: string;
  namespace: string;
  type: 'ClusterIP' | 'NodePort' | 'LoadBalancer';
  ports: Array<{
    port: number;
    targetPort: number;
    protocol: 'TCP' | 'UDP';
  }>;
  selector: Record<string, string>;
}

@Injectable()
export class KubernetesConfigService {
  private readonly logger = new Logger(KubernetesConfigService.name);

  /**
   * Create deployment configuration
   * @param config - Container configuration
   * @returns Promise<string> - Deployment configuration YAML
   */
  async createDeploymentConfig(config: ContainerConfig): Promise<string> {
    try {
      const deployment = {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        metadata: {
          name: config.image,
          namespace: 'default',
          labels: {
            app: config.image,
            version: config.tag,
          },
        },
        spec: {
          replicas: config.replicas,
          selector: {
            matchLabels: {
              app: config.image,
            },
          },
          template: {
            metadata: {
              labels: {
                app: config.image,
                version: config.tag,
              },
            },
            spec: {
              containers: [
                {
                  name: config.image,
                  image: `${config.image}:${config.tag}`,
                  ports: config.ports.map(port => ({
                    containerPort: port.containerPort,
                    protocol: port.protocol,
                  })),
                  env: Object.entries(config.environment).map(([key, value]) => ({
                    name: key,
                    value,
                  })),
                  resources: {
                    requests: {
                      cpu: config.cpu.requests,
                      memory: config.memory.requests,
                    },
                    limits: {
                      cpu: config.cpu.limits,
                      memory: config.memory.limits,
                    },
                  },
                  livenessProbe: {
                    httpGet: {
                      path: config.healthCheck.path,
                      port: config.healthCheck.port,
                    },
                    initialDelaySeconds: config.healthCheck.initialDelaySeconds,
                    periodSeconds: config.healthCheck.periodSeconds,
                    timeoutSeconds: config.healthCheck.timeoutSeconds,
                    failureThreshold: config.healthCheck.failureThreshold,
                  },
                  readinessProbe: {
                    httpGet: {
                      path: config.healthCheck.path,
                      port: config.healthCheck.port,
                    },
                    initialDelaySeconds: config.healthCheck.initialDelaySeconds,
                    periodSeconds: config.healthCheck.periodSeconds,
                    timeoutSeconds: config.healthCheck.timeoutSeconds,
                    failureThreshold: config.healthCheck.failureThreshold,
                  },
                },
              ],
            },
          },
        },
      };

      const yaml = this.convertToYaml(deployment);

      this.logger.log(`Kubernetes deployment config generated for ${config.image}`);
      return yaml;
    } catch (error) {
      this.logger.error('Error creating deployment config:', error);
      throw error;
    }
  }

  /**
   * Create service configuration
   * @param config - Service configuration
   * @returns Promise<string> - Service configuration YAML
   */
  async createServiceConfig(config: ServiceConfig): Promise<string> {
    try {
      const service = {
        apiVersion: 'v1',
        kind: 'Service',
        metadata: {
          name: config.name,
          namespace: config.namespace,
          labels: {
            app: config.name,
          },
        },
        spec: {
          type: config.type,
          ports: config.ports.map(port => ({
            port: port.port,
            targetPort: port.targetPort,
            protocol: port.protocol,
          })),
          selector: config.selector,
        },
      };

      const yaml = this.convertToYaml(service);

      this.logger.log(`Kubernetes service config generated for ${config.name}`);
      return yaml;
    } catch (error) {
      this.logger.error('Error creating service config:', error);
      throw error;
    }
  }

  /**
   * Convert object to YAML string
   * @param obj - Object to convert
   * @returns string - YAML string
   */
  private convertToYaml(obj: any): string {
    // Simple YAML conversion - in production, use a proper YAML library
    const indent = (level: number) => '  '.repeat(level);

    const convertValue = (value: any, level: number = 0): string => {
      if (value === null || value === undefined) {
        return 'null';
      }

      if (typeof value === 'string') {
        return `"${value}"`;
      }

      if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
      }

      if (Array.isArray(value)) {
        if (value.length === 0) {
          return '[]';
        }

        const items = value
          .map(item => `${indent(level + 1)}- ${convertValue(item, level + 1)}`)
          .join('\n');

        return `\n${items}`;
      }

      if (typeof value === 'object') {
        const entries = Object.entries(value);
        if (entries.length === 0) {
          return '{}';
        }

        const items = entries
          .map(([key, val]) => `${indent(level)}${key}: ${convertValue(val, level + 1)}`)
          .join('\n');

        return `\n${items}`;
      }

      return String(value);
    };

    return convertValue(obj);
  }
}
