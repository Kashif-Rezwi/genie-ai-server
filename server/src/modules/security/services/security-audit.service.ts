import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
import { LoggingService } from '../../monitoring/services/logging.service';

export interface SecurityVulnerability {
  id: string;
  type: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: 'authentication' | 'authorization' | 'data_protection' | 'network' | 'configuration' | 'dependencies';
  title: string;
  description: string;
  impact: string;
  recommendation: string;
  cve?: string;
  cvss_score?: number;
  detected_at: number;
  status: 'open' | 'in_progress' | 'resolved' | 'false_positive';
  evidence?: Record<string, any>;
}

export interface SecurityAuditReport {
  id: string;
  timestamp: number;
  overall_score: number;
  vulnerabilities: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
    total: number;
  };
  categories: {
    authentication: number;
    authorization: number;
    data_protection: number;
    network: number;
    configuration: number;
    dependencies: number;
  };
  recommendations: string[];
  compliance: {
    owasp_top_10: number;
    pci_dss: number;
    gdpr: number;
  };
}

export interface SecurityCheck {
  id: string;
  name: string;
  description: string;
  category: string;
  enabled: boolean;
  last_run?: number;
  last_result?: 'pass' | 'fail' | 'warning';
  last_message?: string;
}

@Injectable()
export class SecurityAuditService {
  private readonly logger = new Logger(SecurityAuditService.name);
  private readonly vulnerabilities: SecurityVulnerability[] = [];
  private readonly auditReports: SecurityAuditReport[] = [];
  private readonly securityChecks: SecurityCheck[] = [];
  private readonly maxVulnerabilities = 1000;
  private readonly maxReports = 100;

  constructor(
    private readonly redisService: RedisService,
    private readonly loggingService: LoggingService,
  ) {
    this.initializeSecurityChecks();
  }

  /**
   * Run comprehensive security audit
   */
  async runSecurityAudit(): Promise<SecurityAuditReport> {
    this.logger.log('Starting comprehensive security audit...');

    const vulnerabilities: SecurityVulnerability[] = [];
    const recommendations: string[] = [];

    // Run all security checks
    for (const check of this.securityChecks.filter(c => c.enabled)) {
      try {
        const result = await this.runSecurityCheck(check);
        if (result.vulnerabilities.length > 0) {
          vulnerabilities.push(...result.vulnerabilities);
        }
        if (result.recommendations.length > 0) {
          recommendations.push(...result.recommendations);
        }
      } catch (error) {
        this.logger.error(`Security check ${check.name} failed: ${error.message}`);
      }
    }

    // Calculate scores
    const vulnerabilityCounts = this.countVulnerabilitiesByType(vulnerabilities);
    const categoryCounts = this.countVulnerabilitiesByCategory(vulnerabilities);
    const overallScore = this.calculateOverallScore(vulnerabilityCounts);

    // Create audit report
    const report: SecurityAuditReport = {
      id: this.generateId(),
      timestamp: Date.now(),
      overall_score: overallScore,
      vulnerabilities: vulnerabilityCounts,
      categories: categoryCounts,
      recommendations: [...new Set(recommendations)],
      compliance: {
        owasp_top_10: this.calculateOWASPScore(vulnerabilities),
        pci_dss: this.calculatePCIDSSScore(vulnerabilities),
        gdpr: this.calculateGDPRScore(vulnerabilities),
      },
    };

    // Store vulnerabilities and report
    this.vulnerabilities.push(...vulnerabilities);
    this.auditReports.push(report);

    // Cleanup old data
    this.cleanupOldData();

    this.loggingService.log(
      `Security audit completed: ${vulnerabilities.length} vulnerabilities found, score: ${overallScore}`,
      'monitoring',
    );

    return report;
  }

  /**
   * Run specific security check
   */
  async runSecurityCheck(check: SecurityCheck): Promise<{
    vulnerabilities: SecurityVulnerability[];
    recommendations: string[];
  }> {
    const vulnerabilities: SecurityVulnerability[] = [];
    const recommendations: string[] = [];

    switch (check.id) {
      case 'jwt_security':
        const jwtResult = await this.checkJWTSecurity();
        vulnerabilities.push(...jwtResult.vulnerabilities);
        recommendations.push(...jwtResult.recommendations);
        break;

      case 'password_policy':
        const passwordResult = await this.checkPasswordPolicy();
        vulnerabilities.push(...passwordResult.vulnerabilities);
        recommendations.push(...passwordResult.recommendations);
        break;

      case 'https_enforcement':
        const httpsResult = await this.checkHTTPSEnforcement();
        vulnerabilities.push(...httpsResult.vulnerabilities);
        recommendations.push(...httpsResult.recommendations);
        break;

      case 'security_headers':
        const headersResult = await this.checkSecurityHeaders();
        vulnerabilities.push(...headersResult.vulnerabilities);
        recommendations.push(...headersResult.recommendations);
        break;

      case 'input_validation':
        const inputResult = await this.checkInputValidation();
        vulnerabilities.push(...inputResult.vulnerabilities);
        recommendations.push(...inputResult.recommendations);
        break;

      case 'database_security':
        const dbResult = await this.checkDatabaseSecurity();
        vulnerabilities.push(...dbResult.vulnerabilities);
        recommendations.push(...dbResult.recommendations);
        break;

      case 'dependency_vulnerabilities':
        const depResult = await this.checkDependencyVulnerabilities();
        vulnerabilities.push(...depResult.vulnerabilities);
        recommendations.push(...depResult.recommendations);
        break;

      case 'rate_limiting':
        const rateResult = await this.checkRateLimiting();
        vulnerabilities.push(...rateResult.vulnerabilities);
        recommendations.push(...rateResult.recommendations);
        break;

      case 'cors_configuration':
        const corsResult = await this.checkCORSConfiguration();
        vulnerabilities.push(...corsResult.vulnerabilities);
        recommendations.push(...corsResult.recommendations);
        break;

      case 'environment_secrets':
        const secretsResult = await this.checkEnvironmentSecrets();
        vulnerabilities.push(...secretsResult.vulnerabilities);
        recommendations.push(...secretsResult.recommendations);
        break;
    }

    // Update check status
    check.last_run = Date.now();
    check.last_result = vulnerabilities.length > 0 ? 'fail' : 'pass';
    check.last_message = vulnerabilities.length > 0 ? 
      `${vulnerabilities.length} vulnerabilities found` : 
      'No vulnerabilities found';

    return { vulnerabilities, recommendations };
  }

  /**
   * Get security vulnerabilities
   */
  getVulnerabilities(
    type?: string,
    category?: string,
    status?: string,
    limit = 100,
  ): SecurityVulnerability[] {
    let filtered = this.vulnerabilities;

    if (type) {
      filtered = filtered.filter(v => v.type === type);
    }
    if (category) {
      filtered = filtered.filter(v => v.category === category);
    }
    if (status) {
      filtered = filtered.filter(v => v.status === status);
    }

    return filtered.slice(-limit);
  }

  /**
   * Get audit reports
   */
  getAuditReports(limit = 10): SecurityAuditReport[] {
    return this.auditReports.slice(-limit);
  }

  /**
   * Get latest audit report
   */
  getLatestAuditReport(): SecurityAuditReport | null {
    return this.auditReports[this.auditReports.length - 1] || null;
  }

  /**
   * Update vulnerability status
   */
  updateVulnerabilityStatus(vulnerabilityId: string, status: SecurityVulnerability['status']): boolean {
    const vulnerability = this.vulnerabilities.find(v => v.id === vulnerabilityId);
    if (!vulnerability) {
      return false;
    }

    vulnerability.status = status;
    return true;
  }

  /**
   * Get security checks
   */
  getSecurityChecks(): SecurityCheck[] {
    return this.securityChecks;
  }

  /**
   * Update security check
   */
  updateSecurityCheck(checkId: string, updates: Partial<SecurityCheck>): boolean {
    const check = this.securityChecks.find(c => c.id === checkId);
    if (!check) {
      return false;
    }

    Object.assign(check, updates);
    return true;
  }

  // Private methods for specific security checks

  private async checkJWTSecurity(): Promise<{
    vulnerabilities: SecurityVulnerability[];
    recommendations: string[];
  }> {
    const vulnerabilities: SecurityVulnerability[] = [];
    const recommendations: string[] = [];

    // Check JWT secret strength
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret || jwtSecret.length < 32) {
      vulnerabilities.push({
        id: this.generateId(),
        type: 'critical',
        category: 'authentication',
        title: 'Weak JWT Secret',
        description: 'JWT secret is too short or not set',
        impact: 'JWT tokens can be easily compromised',
        recommendation: 'Use a strong JWT secret with at least 32 characters',
        detected_at: Date.now(),
        status: 'open',
        evidence: { secret_length: jwtSecret?.length || 0 },
      });
    }

    // Check JWT expiration
    const jwtExpiresIn = process.env.JWT_EXPIRES_IN;
    if (!jwtExpiresIn || jwtExpiresIn === 'never') {
      vulnerabilities.push({
        id: this.generateId(),
        type: 'high',
        category: 'authentication',
        title: 'JWT Token Never Expires',
        description: 'JWT tokens do not have expiration time',
        impact: 'Compromised tokens remain valid indefinitely',
        recommendation: 'Set appropriate JWT expiration time (e.g., 7d)',
        detected_at: Date.now(),
        status: 'open',
        evidence: { expires_in: jwtExpiresIn },
      });
    }

    return { vulnerabilities, recommendations };
  }

  private async checkPasswordPolicy(): Promise<{
    vulnerabilities: SecurityVulnerability[];
    recommendations: string[];
  }> {
    const vulnerabilities: SecurityVulnerability[] = [];
    const recommendations: string[] = [];

    // This would check password policy implementation
    // For now, we'll add a placeholder check
    recommendations.push('Implement comprehensive password policy validation');

    return { vulnerabilities, recommendations };
  }

  private async checkHTTPSEnforcement(): Promise<{
    vulnerabilities: SecurityVulnerability[];
    recommendations: string[];
  }> {
    const vulnerabilities: SecurityVulnerability[] = [];
    const recommendations: string[] = [];

    // Check if HTTPS is enforced in production
    if (process.env.NODE_ENV === 'production' && !process.env.FORCE_HTTPS) {
      vulnerabilities.push({
        id: this.generateId(),
        type: 'high',
        category: 'network',
        title: 'HTTPS Not Enforced',
        description: 'HTTPS is not enforced in production',
        impact: 'Data transmitted over unencrypted connections',
        recommendation: 'Enable HTTPS enforcement in production',
        detected_at: Date.now(),
        status: 'open',
      });
    }

    return { vulnerabilities, recommendations };
  }

  private async checkSecurityHeaders(): Promise<{
    vulnerabilities: SecurityVulnerability[];
    recommendations: string[];
  }> {
    const vulnerabilities: SecurityVulnerability[] = [];
    const recommendations: string[] = [];

    // Check if security headers are properly configured
    recommendations.push('Verify all security headers are properly configured');

    return { vulnerabilities, recommendations };
  }

  private async checkInputValidation(): Promise<{
    vulnerabilities: SecurityVulnerability[];
    recommendations: string[];
  }> {
    const vulnerabilities: SecurityVulnerability[] = [];
    const recommendations: string[] = [];

    // Check input validation implementation
    recommendations.push('Ensure all inputs are properly validated and sanitized');

    return { vulnerabilities, recommendations };
  }

  private async checkDatabaseSecurity(): Promise<{
    vulnerabilities: SecurityVulnerability[];
    recommendations: string[];
  }> {
    const vulnerabilities: SecurityVulnerability[] = [];
    const recommendations: string[] = [];

    // Check database security configuration
    const dbPassword = process.env.POSTGRES_PASSWORD;
    if (!dbPassword || dbPassword.length < 12) {
      vulnerabilities.push({
        id: this.generateId(),
        type: 'high',
        category: 'data_protection',
        title: 'Weak Database Password',
        description: 'Database password is too weak',
        impact: 'Database can be easily compromised',
        recommendation: 'Use a strong database password with at least 12 characters',
        detected_at: Date.now(),
        status: 'open',
        evidence: { password_length: dbPassword?.length || 0 },
      });
    }

    return { vulnerabilities, recommendations };
  }

  private async checkDependencyVulnerabilities(): Promise<{
    vulnerabilities: SecurityVulnerability[];
    recommendations: string[];
  }> {
    const vulnerabilities: SecurityVulnerability[] = [];
    const recommendations: string[] = [];

    // This would check for known vulnerabilities in dependencies
    recommendations.push('Run npm audit to check for dependency vulnerabilities');

    return { vulnerabilities, recommendations };
  }

  private async checkRateLimiting(): Promise<{
    vulnerabilities: SecurityVulnerability[];
    recommendations: string[];
  }> {
    const vulnerabilities: SecurityVulnerability[] = [];
    const recommendations: string[] = [];

    // Check rate limiting configuration
    recommendations.push('Verify rate limiting is properly configured and effective');

    return { vulnerabilities, recommendations };
  }

  private async checkCORSConfiguration(): Promise<{
    vulnerabilities: SecurityVulnerability[];
    recommendations: string[];
  }> {
    const vulnerabilities: SecurityVulnerability[] = [];
    const recommendations: string[] = [];

    // Check CORS configuration
    const corsOrigin = process.env.CORS_ORIGIN;
    if (corsOrigin === '*' || !corsOrigin) {
      vulnerabilities.push({
        id: this.generateId(),
        type: 'medium',
        category: 'network',
        title: 'Overly Permissive CORS',
        description: 'CORS is configured to allow all origins',
        impact: 'Potential for cross-origin attacks',
        recommendation: 'Configure specific allowed origins for CORS',
        detected_at: Date.now(),
        status: 'open',
        evidence: { cors_origin: corsOrigin },
      });
    }

    return { vulnerabilities, recommendations };
  }

  private async checkEnvironmentSecrets(): Promise<{
    vulnerabilities: SecurityVulnerability[];
    recommendations: string[];
  }> {
    const vulnerabilities: SecurityVulnerability[] = [];
    const recommendations: string[] = [];

    // Check for hardcoded secrets
    const sensitiveEnvVars = ['JWT_SECRET', 'POSTGRES_PASSWORD', 'REDIS_PASSWORD'];
    for (const envVar of sensitiveEnvVars) {
      const value = process.env[envVar];
      if (value && (value.includes('password') || value.includes('secret') || value.length < 8)) {
        vulnerabilities.push({
          id: this.generateId(),
          type: 'high',
          category: 'configuration',
          title: `Weak ${envVar}`,
          description: `${envVar} appears to be weak or default`,
          impact: 'Sensitive data can be easily compromised',
          recommendation: `Use a strong, unique value for ${envVar}`,
          detected_at: Date.now(),
          status: 'open',
          evidence: { environment_variable: envVar },
        });
      }
    }

    return { vulnerabilities, recommendations };
  }

  private initializeSecurityChecks(): void {
    this.securityChecks.push(
      {
        id: 'jwt_security',
        name: 'JWT Security',
        description: 'Check JWT token security configuration',
        category: 'authentication',
        enabled: true,
      },
      {
        id: 'password_policy',
        name: 'Password Policy',
        description: 'Check password policy implementation',
        category: 'authentication',
        enabled: true,
      },
      {
        id: 'https_enforcement',
        name: 'HTTPS Enforcement',
        description: 'Check HTTPS enforcement in production',
        category: 'network',
        enabled: true,
      },
      {
        id: 'security_headers',
        name: 'Security Headers',
        description: 'Check security headers configuration',
        category: 'configuration',
        enabled: true,
      },
      {
        id: 'input_validation',
        name: 'Input Validation',
        description: 'Check input validation implementation',
        category: 'data_protection',
        enabled: true,
      },
      {
        id: 'database_security',
        name: 'Database Security',
        description: 'Check database security configuration',
        category: 'data_protection',
        enabled: true,
      },
      {
        id: 'dependency_vulnerabilities',
        name: 'Dependency Vulnerabilities',
        description: 'Check for known vulnerabilities in dependencies',
        category: 'dependencies',
        enabled: true,
      },
      {
        id: 'rate_limiting',
        name: 'Rate Limiting',
        description: 'Check rate limiting configuration',
        category: 'configuration',
        enabled: true,
      },
      {
        id: 'cors_configuration',
        name: 'CORS Configuration',
        description: 'Check CORS configuration',
        category: 'network',
        enabled: true,
      },
      {
        id: 'environment_secrets',
        name: 'Environment Secrets',
        description: 'Check for weak or default environment secrets',
        category: 'configuration',
        enabled: true,
      },
    );
  }

  private countVulnerabilitiesByType(vulnerabilities: SecurityVulnerability[]): {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
    total: number;
  } {
    const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0, total: 0 };
    
    for (const vuln of vulnerabilities) {
      counts[vuln.type]++;
      counts.total++;
    }
    
    return counts;
  }

  private countVulnerabilitiesByCategory(vulnerabilities: SecurityVulnerability[]): {
    authentication: number;
    authorization: number;
    data_protection: number;
    network: number;
    configuration: number;
    dependencies: number;
  } {
    const counts = {
      authentication: 0,
      authorization: 0,
      data_protection: 0,
      network: 0,
      configuration: 0,
      dependencies: 0,
    };
    
    for (const vuln of vulnerabilities) {
      counts[vuln.category]++;
    }
    
    return counts;
  }

  private calculateOverallScore(vulnerabilityCounts: any): number {
    const weights = { critical: 10, high: 7, medium: 4, low: 2, info: 1 };
    const maxScore = 100;
    
    let totalWeight = 0;
    for (const [type, count] of Object.entries(vulnerabilityCounts)) {
      if (type !== 'total') {
        totalWeight += (count as number) * weights[type as keyof typeof weights];
      }
    }
    
    return Math.max(0, maxScore - totalWeight);
  }

  private calculateOWASPScore(vulnerabilities: SecurityVulnerability[]): number {
    // Simplified OWASP Top 10 compliance score
    const owaspCategories = ['authentication', 'authorization', 'data_protection'];
    const owaspVulns = vulnerabilities.filter(v => owaspCategories.includes(v.category));
    return Math.max(0, 100 - (owaspVulns.length * 10));
  }

  private calculatePCIDSSScore(vulnerabilities: SecurityVulnerability[]): number {
    // Simplified PCI DSS compliance score
    const pciVulns = vulnerabilities.filter(v => 
      v.category === 'data_protection' || v.type === 'critical'
    );
    return Math.max(0, 100 - (pciVulns.length * 15));
  }

  private calculateGDPRScore(vulnerabilities: SecurityVulnerability[]): number {
    // Simplified GDPR compliance score
    const gdprVulns = vulnerabilities.filter(v => 
      v.category === 'data_protection' || v.category === 'configuration'
    );
    return Math.max(0, 100 - (gdprVulns.length * 8));
  }

  private cleanupOldData(): void {
    // Cleanup old vulnerabilities
    if (this.vulnerabilities.length > this.maxVulnerabilities) {
      this.vulnerabilities.splice(0, this.vulnerabilities.length - this.maxVulnerabilities);
    }

    // Cleanup old reports
    if (this.auditReports.length > this.maxReports) {
      this.auditReports.splice(0, this.auditReports.length - this.maxReports);
    }
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
