import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard, Roles, UserRole } from '../security/guards/roles.guard';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { SecurityAuditService, SecurityVulnerability, SecurityAuditReport } from '../security/services/security-audit.service';
import { HealthService } from '../monitoring/services/health.service';
import { MetricsService } from '../monitoring/services/metrics.service';
import { AlertingService } from '../monitoring/services/alerting.service';

@Controller('production')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class ProductionReadinessController {
  constructor(
    private readonly securityAuditService: SecurityAuditService,
    private readonly healthService: HealthService,
    private readonly metricsService: MetricsService,
    private readonly alertingService: AlertingService,
  ) {}

  /**
   * Get production readiness status
   */
  @Get('readiness')
  async getProductionReadiness(): Promise<ApiResponseDto> {
    const health = await this.healthService.getQuickHealthStatus();
    const metrics = this.metricsService.getMetrics();
    const activeAlerts = await this.alertingService.getActiveAlerts();
    const latestAudit = this.securityAuditService.getLatestAuditReport();

    // Calculate readiness score
    const readinessScore = this.calculateReadinessScore(health, metrics, activeAlerts, latestAudit);

    const readiness = {
      score: readinessScore,
      status: readinessScore >= 80 ? 'ready' : readinessScore >= 60 ? 'warning' : 'not_ready',
      checks: {
        health: {
          status: health.status,
          score: health.status === 'ok' ? 100 : 0,
        },
        performance: {
          avgResponseTime: metrics.performance.responseTimePercentiles.p95,
          score: metrics.performance.responseTimePercentiles.p95 < 200 ? 100 : 50,
        },
        security: {
          auditScore: latestAudit?.overall_score || 0,
          vulnerabilities: latestAudit?.vulnerabilities.total || 0,
          score: latestAudit?.overall_score || 0,
        },
        monitoring: {
          activeAlerts: activeAlerts.length,
          score: activeAlerts.length === 0 ? 100 : Math.max(0, 100 - activeAlerts.length * 10),
        },
      },
      recommendations: this.generateRecommendations(health, metrics, activeAlerts, latestAudit),
    };

    return {
      success: true,
      message: 'Production readiness status retrieved successfully',
      data: readiness,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Run security audit
   */
  @Post('security-audit')
  async runSecurityAudit(): Promise<ApiResponseDto> {
    const auditReport = await this.securityAuditService.runSecurityAudit();
    
    return {
      success: true,
      message: 'Security audit completed successfully',
      data: auditReport,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get security vulnerabilities
   */
  @Get('security/vulnerabilities')
  async getSecurityVulnerabilities(): Promise<ApiResponseDto> {
    const vulnerabilities = this.securityAuditService.getVulnerabilities();
    
    return {
      success: true,
      message: 'Security vulnerabilities retrieved successfully',
      data: vulnerabilities,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get security audit reports
   */
  @Get('security/audit-reports')
  async getSecurityAuditReports(): Promise<ApiResponseDto> {
    const reports = this.securityAuditService.getAuditReports();
    
    return {
      success: true,
      message: 'Security audit reports retrieved successfully',
      data: reports,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get production health check
   */
  @Get('health')
  async getProductionHealth(): Promise<ApiResponseDto> {
    const health = await this.healthService.getQuickHealthStatus();
    const metrics = this.metricsService.getMetrics();
    const activeAlerts = await this.alertingService.getActiveAlerts();

    const productionHealth = {
      status: health.status,
      timestamp: health.timestamp,
      services: {
        database: 'ok', // Simplified for now
        redis: 'ok', // Simplified for now
        application: health.status,
      },
      metrics: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        requests: metrics.requests,
        errors: metrics.errors,
      },
      alerts: {
        active: activeAlerts.length,
        critical: activeAlerts.filter(a => a.severity === 'critical').length,
      },
    };

    return {
      success: true,
      message: 'Production health check completed',
      data: productionHealth,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get deployment status
   */
  @Get('deployment/status')
  async getDeploymentStatus(): Promise<ApiResponseDto> {
    const deploymentStatus = {
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      buildDate: process.env.BUILD_DATE || 'unknown',
      gitCommit: process.env.GIT_COMMIT || 'unknown',
      uptime: process.uptime(),
      nodeVersion: process.version,
      platform: process.platform,
      architecture: process.arch,
      pid: process.pid,
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
    };

    return {
      success: true,
      message: 'Deployment status retrieved successfully',
      data: deploymentStatus,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get system metrics
   */
  @Get('metrics')
  async getSystemMetrics(): Promise<ApiResponseDto> {
    const metrics = this.metricsService.getMetrics();
    const systemMetrics = {
      application: metrics,
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        platform: process.platform,
        architecture: process.arch,
        nodeVersion: process.version,
      },
      timestamp: Date.now(),
    };

    return {
      success: true,
      message: 'System metrics retrieved successfully',
      data: systemMetrics,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get production checklist
   */
  @Get('checklist')
  async getProductionChecklist(): Promise<ApiResponseDto> {
    const checklist = {
      security: [
        { item: 'JWT secret is strong and secure', status: 'pending' },
        { item: 'HTTPS is enforced in production', status: 'pending' },
        { item: 'Security headers are configured', status: 'pending' },
        { item: 'Input validation is implemented', status: 'pending' },
        { item: 'Rate limiting is configured', status: 'pending' },
        { item: 'CORS is properly configured', status: 'pending' },
        { item: 'Environment secrets are secure', status: 'pending' },
      ],
      performance: [
        { item: 'Database queries are optimized', status: 'pending' },
        { item: 'Redis caching is implemented', status: 'pending' },
        { item: 'Response times are under 200ms', status: 'pending' },
        { item: 'Connection pooling is configured', status: 'pending' },
        { item: 'Compression is enabled', status: 'pending' },
      ],
      monitoring: [
        { item: 'Health checks are implemented', status: 'pending' },
        { item: 'Logging is configured', status: 'pending' },
        { item: 'Metrics collection is active', status: 'pending' },
        { item: 'Alerting is configured', status: 'pending' },
        { item: 'APM is integrated', status: 'pending' },
      ],
      deployment: [
        { item: 'Docker containers are configured', status: 'pending' },
        { item: 'Environment variables are set', status: 'pending' },
        { item: 'Database migrations are ready', status: 'pending' },
        { item: 'Backup strategy is implemented', status: 'pending' },
        { item: 'Disaster recovery plan is ready', status: 'pending' },
      ],
      testing: [
        { item: 'Unit tests are passing', status: 'pending' },
        { item: 'Integration tests are passing', status: 'pending' },
        { item: 'Security tests are passing', status: 'pending' },
        { item: 'Performance tests are passing', status: 'pending' },
        { item: 'End-to-end tests are passing', status: 'pending' },
      ],
    };

    return {
      success: true,
      message: 'Production checklist retrieved successfully',
      data: checklist,
      timestamp: new Date().toISOString(),
    };
  }

  private calculateReadinessScore(
    health: any,
    metrics: any,
    activeAlerts: any[],
    latestAudit: SecurityAuditReport | null,
  ): number {
    let score = 0;
    let totalChecks = 0;

    // Health check (25%)
    if (health.status === 'ok') {
      score += 25;
    }
    totalChecks += 25;

    // Performance check (25%)
    if (metrics.performance.responseTimePercentiles.p95 < 200) {
      score += 25;
    } else if (metrics.performance.responseTimePercentiles.p95 < 500) {
      score += 15;
    }
    totalChecks += 25;

    // Security check (25%)
    if (latestAudit) {
      score += (latestAudit.overall_score / 100) * 25;
    }
    totalChecks += 25;

    // Monitoring check (25%)
    if (activeAlerts.length === 0) {
      score += 25;
    } else {
      score += Math.max(0, 25 - activeAlerts.length * 5);
    }
    totalChecks += 25;

    return Math.round((score / totalChecks) * 100);
  }

  private generateRecommendations(
    health: any,
    metrics: any,
    activeAlerts: any[],
    latestAudit: SecurityAuditReport | null,
  ): string[] {
    const recommendations: string[] = [];

    // Health recommendations
    if (health.status !== 'ok') {
      recommendations.push('Fix health check issues to ensure system stability');
    }

    // Performance recommendations
    if (metrics.performance.responseTimePercentiles.p95 > 200) {
      recommendations.push('Optimize response times to improve user experience');
    }

    // Security recommendations
    if (latestAudit && latestAudit.overall_score < 80) {
      recommendations.push('Address security vulnerabilities to improve security posture');
    }

    // Monitoring recommendations
    if (activeAlerts.length > 0) {
      recommendations.push('Resolve active alerts to ensure system reliability');
    }

    // General recommendations
    if (process.env.NODE_ENV !== 'production') {
      recommendations.push('Deploy to production environment for final testing');
    }

    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      recommendations.push('Configure a strong JWT secret for production');
    }

    if (!process.env.FORCE_HTTPS) {
      recommendations.push('Enable HTTPS enforcement in production');
    }

    return recommendations;
  }
}
