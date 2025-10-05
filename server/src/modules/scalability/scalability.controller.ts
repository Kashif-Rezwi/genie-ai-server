import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  ScalabilityService,
  ScalingMetrics,
  ScalingDecision,
  HealthCheckResult,
} from './services/scalability.service';
import {
  LoadBalancerService,
  LoadBalancerConfig,
  BackendServer,
  LoadBalancerStats,
} from './services/load-balancer.service';
import {
  AutoScalingService,
  AutoScalingConfig,
  ScalingEvent,
  AutoScalingStats,
} from './services/auto-scaling.service';
import {
  ContainerOrchestrationService,
  ContainerConfig,
  ServiceConfig,
  OrchestrationStats,
} from './services/container-orchestration.service';
import { ApiResponseDto } from '../../common/dto/api-response.dto';

@ApiTags('Scalability')
@Controller('scalability')
export class ScalabilityController {
  constructor(
    private readonly scalabilityService: ScalabilityService,
    private readonly loadBalancerService: LoadBalancerService,
    private readonly autoScalingService: AutoScalingService,
    private readonly containerOrchestrationService: ContainerOrchestrationService
  ) {}

  // Scaling Metrics Endpoints
  @Get('metrics')
  @ApiOperation({ summary: 'Get current scaling metrics' })
  @ApiResponse({ status: 200, description: 'Metrics retrieved successfully' })
  async getMetrics(): Promise<ApiResponseDto<ScalingMetrics>> {
    const metrics = await this.scalabilityService.collectMetrics();

    return {
      success: true,
      message: 'Metrics retrieved successfully',
      data: metrics,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('scaling-decision')
  @ApiOperation({ summary: 'Make scaling decision' })
  @ApiResponse({ status: 200, description: 'Scaling decision made successfully' })
  @HttpCode(HttpStatus.OK)
  async makeScalingDecision(
    @Body() body: { thresholds?: any }
  ): Promise<ApiResponseDto<ScalingDecision>> {
    const decision = await this.scalabilityService.makeScalingDecision(body.thresholds);

    return {
      success: true,
      message: 'Scaling decision made successfully',
      data: decision,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('health-check')
  @ApiOperation({ summary: 'Perform health check' })
  @ApiResponse({ status: 200, description: 'Health check completed successfully' })
  async performHealthCheck(): Promise<ApiResponseDto<HealthCheckResult>> {
    const healthCheck = await this.scalabilityService.performHealthCheck();

    return {
      success: true,
      message: 'Health check completed successfully',
      data: healthCheck,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('scaling-history')
  @ApiOperation({ summary: 'Get scaling history' })
  @ApiResponse({ status: 200, description: 'Scaling history retrieved successfully' })
  async getScalingHistory(
    @Query('limit') limit: number = 50
  ): Promise<ApiResponseDto<ScalingDecision[]>> {
    const history = await this.scalabilityService.getScalingHistory(limit);

    return {
      success: true,
      message: 'Scaling history retrieved successfully',
      data: history,
      timestamp: new Date().toISOString(),
    };
  }

  // Load Balancer Endpoints
  @Post('load-balancer/initialize')
  @ApiOperation({ summary: 'Initialize load balancer' })
  @ApiResponse({ status: 200, description: 'Load balancer initialized successfully' })
  @HttpCode(HttpStatus.OK)
  async initializeLoadBalancer(
    @Body()
    body: {
      backends: Omit<
        BackendServer,
        | 'health'
        | 'lastHealthCheck'
        | 'activeConnections'
        | 'totalRequests'
        | 'errorCount'
        | 'responseTime'
      >[];
      config?: Partial<LoadBalancerConfig>;
    }
  ): Promise<ApiResponseDto<{ initialized: boolean }>> {
    await this.loadBalancerService.initialize(body.backends, body.config);

    return {
      success: true,
      message: 'Load balancer initialized successfully',
      data: { initialized: true },
      timestamp: new Date().toISOString(),
    };
  }

  @Post('load-balancer/backends')
  @ApiOperation({ summary: 'Register backend server' })
  @ApiResponse({ status: 200, description: 'Backend server registered successfully' })
  @HttpCode(HttpStatus.OK)
  async registerBackend(
    @Body() backend: BackendServer
  ): Promise<ApiResponseDto<{ registered: boolean }>> {
    await this.loadBalancerService.registerBackend(backend);

    return {
      success: true,
      message: 'Backend server registered successfully',
      data: { registered: true },
      timestamp: new Date().toISOString(),
    };
  }

  @Get('load-balancer/backends')
  @ApiOperation({ summary: 'Get next backend server' })
  @ApiResponse({ status: 200, description: 'Backend server retrieved successfully' })
  async getNextBackend(
    @Query('clientIp') clientIp?: string
  ): Promise<ApiResponseDto<BackendServer | null>> {
    const backend = await this.loadBalancerService.getNextBackend(clientIp);

    return {
      success: true,
      message: 'Backend server retrieved successfully',
      data: backend,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('load-balancer/health-checks')
  @ApiOperation({ summary: 'Perform health checks' })
  @ApiResponse({ status: 200, description: 'Health checks completed successfully' })
  @HttpCode(HttpStatus.OK)
  async performHealthChecks(): Promise<ApiResponseDto<any[]>> {
    const results = await this.loadBalancerService.performHealthChecks();

    return {
      success: true,
      message: 'Health checks completed successfully',
      data: results,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('load-balancer/stats')
  @ApiOperation({ summary: 'Get load balancer statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  async getLoadBalancerStats(): Promise<ApiResponseDto<LoadBalancerStats>> {
    const stats = await this.loadBalancerService.getStats();

    return {
      success: true,
      message: 'Load balancer statistics retrieved successfully',
      data: stats,
      timestamp: new Date().toISOString(),
    };
  }

  // Auto-Scaling Endpoints
  @Post('auto-scaling/initialize')
  @ApiOperation({ summary: 'Initialize auto-scaling' })
  @ApiResponse({ status: 200, description: 'Auto-scaling initialized successfully' })
  @HttpCode(HttpStatus.OK)
  async initializeAutoScaling(
    @Body() config: Partial<AutoScalingConfig>
  ): Promise<ApiResponseDto<{ initialized: boolean }>> {
    await this.autoScalingService.initialize(config);

    return {
      success: true,
      message: 'Auto-scaling initialized successfully',
      data: { initialized: true },
      timestamp: new Date().toISOString(),
    };
  }

  @Put('auto-scaling/enable')
  @ApiOperation({ summary: 'Enable auto-scaling' })
  @ApiResponse({ status: 200, description: 'Auto-scaling enabled successfully' })
  @HttpCode(HttpStatus.OK)
  async enableAutoScaling(): Promise<ApiResponseDto<{ enabled: boolean }>> {
    await this.autoScalingService.enable();

    return {
      success: true,
      message: 'Auto-scaling enabled successfully',
      data: { enabled: true },
      timestamp: new Date().toISOString(),
    };
  }

  @Put('auto-scaling/disable')
  @ApiOperation({ summary: 'Disable auto-scaling' })
  @ApiResponse({ status: 200, description: 'Auto-scaling disabled successfully' })
  @HttpCode(HttpStatus.OK)
  async disableAutoScaling(): Promise<ApiResponseDto<{ disabled: boolean }>> {
    await this.autoScalingService.disable();

    return {
      success: true,
      message: 'Auto-scaling disabled successfully',
      data: { disabled: true },
      timestamp: new Date().toISOString(),
    };
  }

  @Get('auto-scaling/config')
  @ApiOperation({ summary: 'Get auto-scaling configuration' })
  @ApiResponse({ status: 200, description: 'Configuration retrieved successfully' })
  async getAutoScalingConfig(): Promise<ApiResponseDto<AutoScalingConfig>> {
    const config = await this.autoScalingService.getConfig();

    return {
      success: true,
      message: 'Auto-scaling configuration retrieved successfully',
      data: config,
      timestamp: new Date().toISOString(),
    };
  }

  @Put('auto-scaling/config')
  @ApiOperation({ summary: 'Update auto-scaling configuration' })
  @ApiResponse({ status: 200, description: 'Configuration updated successfully' })
  @HttpCode(HttpStatus.OK)
  async updateAutoScalingConfig(
    @Body() config: AutoScalingConfig
  ): Promise<ApiResponseDto<{ updated: boolean }>> {
    await this.autoScalingService.updateConfig(config);

    return {
      success: true,
      message: 'Auto-scaling configuration updated successfully',
      data: { updated: true },
      timestamp: new Date().toISOString(),
    };
  }

  @Get('auto-scaling/stats')
  @ApiOperation({ summary: 'Get auto-scaling statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  async getAutoScalingStats(): Promise<ApiResponseDto<AutoScalingStats>> {
    const stats = await this.autoScalingService.getStats();

    return {
      success: true,
      message: 'Auto-scaling statistics retrieved successfully',
      data: stats,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('auto-scaling/events')
  @ApiOperation({ summary: 'Get auto-scaling events' })
  @ApiResponse({ status: 200, description: 'Events retrieved successfully' })
  async getAutoScalingEvents(
    @Query('limit') limit: number = 50
  ): Promise<ApiResponseDto<ScalingEvent[]>> {
    const events = await this.autoScalingService.getRecentEvents(limit);

    return {
      success: true,
      message: 'Auto-scaling events retrieved successfully',
      data: events,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('auto-scaling/trigger')
  @ApiOperation({ summary: 'Manually trigger scaling decision' })
  @ApiResponse({ status: 200, description: 'Scaling decision triggered successfully' })
  @HttpCode(HttpStatus.OK)
  async triggerScalingDecision(): Promise<ApiResponseDto<ScalingEvent>> {
    const event = await this.autoScalingService.triggerScalingDecision();

    return {
      success: true,
      message: 'Scaling decision triggered successfully',
      data: event,
      timestamp: new Date().toISOString(),
    };
  }

  // Container Orchestration Endpoints
  @Post('container/deployment')
  @ApiOperation({ summary: 'Create deployment configuration' })
  @ApiResponse({ status: 200, description: 'Deployment configuration created successfully' })
  @HttpCode(HttpStatus.OK)
  async createDeploymentConfig(
    @Body() config: ContainerConfig
  ): Promise<ApiResponseDto<{ yaml: string }>> {
    const yaml = await this.containerOrchestrationService.createDeploymentConfig(config);

    return {
      success: true,
      message: 'Deployment configuration created successfully',
      data: { yaml },
      timestamp: new Date().toISOString(),
    };
  }

  @Post('container/service')
  @ApiOperation({ summary: 'Create service configuration' })
  @ApiResponse({ status: 200, description: 'Service configuration created successfully' })
  @HttpCode(HttpStatus.OK)
  async createServiceConfig(
    @Body() config: ServiceConfig
  ): Promise<ApiResponseDto<{ yaml: string }>> {
    const yaml = await this.containerOrchestrationService.createServiceConfig(config);

    return {
      success: true,
      message: 'Service configuration created successfully',
      data: { yaml },
      timestamp: new Date().toISOString(),
    };
  }

  @Post('container/docker-compose')
  @ApiOperation({ summary: 'Generate Docker Compose configuration' })
  @ApiResponse({ status: 200, description: 'Docker Compose configuration generated successfully' })
  @HttpCode(HttpStatus.OK)
  async generateDockerCompose(
    @Body() config: ContainerConfig
  ): Promise<ApiResponseDto<{ yaml: string }>> {
    const yaml = await this.containerOrchestrationService.generateDockerCompose(config);

    return {
      success: true,
      message: 'Docker Compose configuration generated successfully',
      data: { yaml },
      timestamp: new Date().toISOString(),
    };
  }

  @Put('container/scale/:deploymentName')
  @ApiOperation({ summary: 'Scale deployment' })
  @ApiResponse({ status: 200, description: 'Deployment scaled successfully' })
  @HttpCode(HttpStatus.OK)
  async scaleDeployment(
    @Param('deploymentName') deploymentName: string,
    @Body() body: { replicas: number }
  ): Promise<ApiResponseDto<{ scaled: boolean }>> {
    const scaled = await this.containerOrchestrationService.scaleDeployment(
      deploymentName,
      body.replicas
    );

    return {
      success: true,
      message: 'Deployment scaled successfully',
      data: { scaled },
      timestamp: new Date().toISOString(),
    };
  }

  @Get('container/deployment/:deploymentName/status')
  @ApiOperation({ summary: 'Get deployment status' })
  @ApiResponse({ status: 200, description: 'Deployment status retrieved successfully' })
  async getDeploymentStatus(
    @Param('deploymentName') deploymentName: string
  ): Promise<ApiResponseDto<any>> {
    const status = await this.containerOrchestrationService.getDeploymentStatus(deploymentName);

    return {
      success: true,
      message: 'Deployment status retrieved successfully',
      data: status,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('container/service/:serviceName/status')
  @ApiOperation({ summary: 'Get service status' })
  @ApiResponse({ status: 200, description: 'Service status retrieved successfully' })
  async getServiceStatus(@Param('serviceName') serviceName: string): Promise<ApiResponseDto<any>> {
    const status = await this.containerOrchestrationService.getServiceStatus(serviceName);

    return {
      success: true,
      message: 'Service status retrieved successfully',
      data: status,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('container/stats')
  @ApiOperation({ summary: 'Get orchestration statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  async getOrchestrationStats(): Promise<ApiResponseDto<OrchestrationStats>> {
    const stats = await this.containerOrchestrationService.getStats();

    return {
      success: true,
      message: 'Orchestration statistics retrieved successfully',
      data: stats,
      timestamp: new Date().toISOString(),
    };
  }

  // Health Check Endpoint
  @Get('health')
  @ApiOperation({ summary: 'Get scalability health status' })
  @ApiResponse({ status: 200, description: 'Health status retrieved successfully' })
  async getHealthStatus(): Promise<ApiResponseDto<any>> {
    const healthCheck = await this.scalabilityService.performHealthCheck();
    const autoScalingStats = await this.autoScalingService.getStats();
    const loadBalancerStats = await this.loadBalancerService.getStats();
    const orchestrationStats = await this.containerOrchestrationService.getStats();

    const health = {
      timestamp: new Date().toISOString(),
      overall: healthCheck.status,
      services: {
        scalability: healthCheck.status,
        autoScaling: autoScalingStats.totalEvents > 0 ? 'active' : 'inactive',
        loadBalancer: loadBalancerStats.healthyBackends > 0 ? 'active' : 'inactive',
        orchestration: orchestrationStats.totalDeployments > 0 ? 'active' : 'inactive',
      },
      metrics: healthCheck.metrics,
      stats: {
        autoScaling: autoScalingStats,
        loadBalancer: loadBalancerStats,
        orchestration: orchestrationStats,
      },
    };

    return {
      success: true,
      message: 'Scalability health status retrieved successfully',
      data: health,
      timestamp: new Date().toISOString(),
    };
  }
}
