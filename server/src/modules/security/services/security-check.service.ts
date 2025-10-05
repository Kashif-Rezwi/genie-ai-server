import { Injectable, Logger } from '@nestjs/common';
import { LoggingService } from '../../monitoring/services/logging.service';
import { SecurityVulnerability } from './security-vulnerability.service';

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
export class SecurityCheckService {
  private readonly logger = new Logger(SecurityCheckService.name);
  private readonly securityChecks: SecurityCheck[] = [];

  constructor(private readonly loggingService: LoggingService) {
    this.initializeSecurityChecks();
  }

  /**
   * Get all security checks
   */
  getSecurityChecks(): SecurityCheck[] {
    return this.securityChecks;
  }

  /**
   * Update security check configuration
   */
  updateSecurityCheck(checkId: string, updates: Partial<SecurityCheck>): boolean {
    const check = this.securityChecks.find(c => c.id === checkId);
    if (!check) {
      return false;
    }

    Object.assign(check, updates);
    this.loggingService.log(
      `Security check ${checkId} updated`,
      'security',
    );
    return true;
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

    this.logger.log(`Running security check: ${check.name}`);

    try {
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

    } catch (error) {
      this.logger.error(`Security check ${check.name} failed: ${error.message}`);
      check.last_result = 'fail';
      check.last_message = `Check failed: ${error.message}`;
    }

    return { vulnerabilities, recommendations };
  }

  /**
   * Initialize security checks configuration
   */
  private initializeSecurityChecks(): void {
    this.securityChecks.push(
      {
        id: 'jwt_security',
        name: 'JWT Security',
        description: 'Check JWT configuration and security',
        category: 'authentication',
        enabled: true,
      },
      {
        id: 'password_policy',
        name: 'Password Policy',
        description: 'Check password policy enforcement',
        category: 'authentication',
        enabled: true,
      },
      {
        id: 'https_enforcement',
        name: 'HTTPS Enforcement',
        description: 'Check HTTPS enforcement configuration',
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
        description: 'Check for known dependency vulnerabilities',
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
        description: 'Check for exposed secrets in environment',
        category: 'configuration',
        enabled: true,
      },
    );
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
        description: 'JWT secret is too short or missing',
        impact: 'JWT tokens can be easily compromised',
        recommendation: 'Use a strong JWT secret (minimum 32 characters)',
        detected_at: Date.now(),
        status: 'open',
      });
      recommendations.push('Generate a strong JWT secret with at least 32 characters');
    }

    // Check JWT expiration
    const jwtExpiration = process.env.JWT_EXPIRATION;
    if (!jwtExpiration || parseInt(jwtExpiration) > 3600) {
      vulnerabilities.push({
        id: this.generateId(),
        type: 'medium',
        category: 'authentication',
        title: 'Long JWT Expiration',
        description: 'JWT tokens have long expiration time',
        impact: 'Compromised tokens remain valid for extended periods',
        recommendation: 'Set JWT expiration to 1 hour or less',
        detected_at: Date.now(),
        status: 'open',
      });
      recommendations.push('Set JWT_EXPIRATION to 3600 seconds (1 hour) or less');
    }

    return { vulnerabilities, recommendations };
  }

  private async checkPasswordPolicy(): Promise<{
    vulnerabilities: SecurityVulnerability[];
    recommendations: string[];
  }> {
    const vulnerabilities: SecurityVulnerability[] = [];
    const recommendations: string[] = [];

    // This would typically check password policy implementation
    // For now, we'll add a basic check
    recommendations.push('Implement comprehensive password policy validation');

    return { vulnerabilities, recommendations };
  }

  private async checkHTTPSEnforcement(): Promise<{
    vulnerabilities: SecurityVulnerability[];
    recommendations: string[];
  }> {
    const vulnerabilities: SecurityVulnerability[] = [];
    const recommendations: string[] = [];

    const nodeEnv = process.env.NODE_ENV;
    if (nodeEnv === 'production') {
      const httpsRedirect = process.env.HTTPS_REDIRECT;
      if (!httpsRedirect || httpsRedirect !== 'true') {
        vulnerabilities.push({
          id: this.generateId(),
          type: 'high',
          category: 'network',
          title: 'HTTPS Not Enforced',
          description: 'HTTPS redirection not enabled in production',
          impact: 'Data transmitted over unencrypted connections',
          recommendation: 'Enable HTTPS redirection in production',
          detected_at: Date.now(),
          status: 'open',
        });
        recommendations.push('Set HTTPS_REDIRECT=true in production environment');
      }
    }

    return { vulnerabilities, recommendations };
  }

  private async checkSecurityHeaders(): Promise<{
    vulnerabilities: SecurityVulnerability[];
    recommendations: string[];
  }> {
    const vulnerabilities: SecurityVulnerability[] = [];
    const recommendations: string[] = [];

    // Check if security headers are configured
    const helmetEnabled = process.env.HELMET_ENABLED;
    if (!helmetEnabled || helmetEnabled !== 'true') {
      vulnerabilities.push({
        id: this.generateId(),
        type: 'medium',
        category: 'configuration',
        title: 'Security Headers Missing',
        description: 'Helmet security headers not enabled',
        impact: 'Missing security headers increase attack surface',
        recommendation: 'Enable Helmet middleware for security headers',
        detected_at: Date.now(),
        status: 'open',
      });
      recommendations.push('Enable Helmet middleware by setting HELMET_ENABLED=true');
    }

    return { vulnerabilities, recommendations };
  }

  private async checkInputValidation(): Promise<{
    vulnerabilities: SecurityVulnerability[];
    recommendations: string[];
  }> {
    const vulnerabilities: SecurityVulnerability[] = [];
    const recommendations: string[] = [];

    // Check if input validation is properly configured
    recommendations.push('Ensure all input validation is properly implemented');
    recommendations.push('Use class-validator for DTO validation');

    return { vulnerabilities, recommendations };
  }

  private async checkDatabaseSecurity(): Promise<{
    vulnerabilities: SecurityVulnerability[];
    recommendations: string[];
  }> {
    const vulnerabilities: SecurityVulnerability[] = [];
    const recommendations: string[] = [];

    // Check database connection security
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl && !dbUrl.startsWith('postgresql://')) {
      vulnerabilities.push({
        id: this.generateId(),
        type: 'high',
        category: 'data_protection',
        title: 'Insecure Database Connection',
        description: 'Database connection not using secure protocol',
        impact: 'Database credentials and data transmitted in plain text',
        recommendation: 'Use PostgreSQL with SSL enabled',
        detected_at: Date.now(),
        status: 'open',
      });
      recommendations.push('Ensure DATABASE_URL uses postgresql:// with SSL');
    }

    return { vulnerabilities, recommendations };
  }

  private async checkDependencyVulnerabilities(): Promise<{
    vulnerabilities: SecurityVulnerability[];
    recommendations: string[];
  }> {
    const vulnerabilities: SecurityVulnerability[] = [];
    const recommendations: string[] = [];

    // This would typically run npm audit or similar
    recommendations.push('Run npm audit regularly to check for dependency vulnerabilities');
    recommendations.push('Keep dependencies updated to latest secure versions');

    return { vulnerabilities, recommendations };
  }

  private async checkRateLimiting(): Promise<{
    vulnerabilities: SecurityVulnerability[];
    recommendations: string[];
  }> {
    const vulnerabilities: SecurityVulnerability[] = [];
    const recommendations: string[] = [];

    // Check if rate limiting is configured
    const rateLimitEnabled = process.env.RATE_LIMIT_ENABLED;
    if (!rateLimitEnabled || rateLimitEnabled !== 'true') {
      vulnerabilities.push({
        id: this.generateId(),
        type: 'medium',
        category: 'configuration',
        title: 'Rate Limiting Not Enabled',
        description: 'Rate limiting not configured',
        impact: 'API vulnerable to brute force and DoS attacks',
        recommendation: 'Enable rate limiting middleware',
        detected_at: Date.now(),
        status: 'open',
      });
      recommendations.push('Enable rate limiting by setting RATE_LIMIT_ENABLED=true');
    }

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
    if (!corsOrigin || corsOrigin === '*') {
      vulnerabilities.push({
        id: this.generateId(),
        type: 'medium',
        category: 'network',
        title: 'Overly Permissive CORS',
        description: 'CORS configured to allow all origins',
        impact: 'Potential for cross-origin attacks',
        recommendation: 'Configure specific allowed origins',
        detected_at: Date.now(),
        status: 'open',
      });
      recommendations.push('Set CORS_ORIGIN to specific allowed domains');
    }

    return { vulnerabilities, recommendations };
  }

  private async checkEnvironmentSecrets(): Promise<{
    vulnerabilities: SecurityVulnerability[];
    recommendations: string[];
  }> {
    const vulnerabilities: SecurityVulnerability[] = [];
    const recommendations: string[] = [];

    // Check for common secret patterns in environment variables
    const envVars = process.env;
    const secretPatterns = ['password', 'secret', 'key', 'token', 'auth'];
    
    for (const [key, value] of Object.entries(envVars)) {
      const isSecret = secretPatterns.some(pattern => 
        key.toLowerCase().includes(pattern)
      );
      
      if (isSecret && value && value.length < 8) {
        vulnerabilities.push({
          id: this.generateId(),
          type: 'high',
          category: 'configuration',
          title: 'Weak Secret in Environment',
          description: `Environment variable ${key} appears to contain a weak secret`,
          impact: 'Weak secrets can be easily compromised',
          recommendation: 'Use strong, randomly generated secrets',
          detected_at: Date.now(),
          status: 'open',
        });
      }
    }

    return { vulnerabilities, recommendations };
  }

  private generateId(): string {
    return `sec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
