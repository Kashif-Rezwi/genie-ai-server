import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
import { LoggingService } from '../../monitoring/services/logging.service';
import {
  SecurityVulnerabilityService,
  SecurityVulnerability,
  SecurityAuditReport,
} from './security-vulnerability.service';
import { SecurityCheckService, SecurityCheck } from './security-check.service';
import { SecurityComplianceService } from './security-compliance.service';

// Re-export interfaces for external use
export { SecurityVulnerability, SecurityAuditReport } from './security-vulnerability.service';
export { SecurityCheck } from './security-check.service';

@Injectable()
export class SecurityAuditService {
  private readonly logger = new Logger(SecurityAuditService.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly loggingService: LoggingService,
    private readonly vulnerabilityService: SecurityVulnerabilityService,
    private readonly checkService: SecurityCheckService,
    private readonly complianceService: SecurityComplianceService
  ) {}

  /**
   * Run comprehensive security audit
   */
  async runSecurityAudit(): Promise<SecurityAuditReport> {
    this.logger.log('Starting comprehensive security audit...');

    const vulnerabilities: SecurityVulnerability[] = [];
    const recommendations: string[] = [];

    // Run all security checks
    const securityChecks = this.checkService.getSecurityChecks();
    for (const check of securityChecks.filter(c => c.enabled)) {
      try {
        const result = await this.checkService.runSecurityCheck(check);
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

    // Calculate scores using compliance service
    const vulnerabilityCounts =
      this.vulnerabilityService.countVulnerabilitiesByType(vulnerabilities);
    const categoryCounts =
      this.vulnerabilityService.countVulnerabilitiesByCategory(vulnerabilities);
    const overallScore = this.complianceService.calculateOverallScore(vulnerabilityCounts);

    // Create audit report
    const report: SecurityAuditReport = {
      id: this.vulnerabilityService.generateId(),
      timestamp: Date.now(),
      overall_score: overallScore,
      vulnerabilities: vulnerabilityCounts,
      categories: categoryCounts,
      recommendations: [...new Set(recommendations)],
      compliance: {
        owasp_top_10: this.complianceService.calculateOWASPScore(vulnerabilities),
        pci_dss: this.complianceService.calculatePCIDSSScore(vulnerabilities),
        gdpr: this.complianceService.calculateGDPRScore(vulnerabilities),
      },
    };

    // Store vulnerabilities and report
    this.vulnerabilityService.addVulnerabilities(vulnerabilities);
    this.vulnerabilityService.addAuditReport(report);

    this.loggingService.log(
      `Security audit completed: ${vulnerabilities.length} vulnerabilities found, score: ${overallScore}`,
      'monitoring'
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
    return this.checkService.runSecurityCheck(check);
  }

  /**
   * Get security vulnerabilities
   */
  getVulnerabilities(
    type?: string,
    category?: string,
    status?: string,
    limit = 100
  ): SecurityVulnerability[] {
    return this.vulnerabilityService.getVulnerabilities(type, category, status, limit);
  }

  /**
   * Get audit reports
   */
  getAuditReports(limit = 10): SecurityAuditReport[] {
    return this.vulnerabilityService.getAuditReports(limit);
  }

  /**
   * Get latest audit report
   */
  getLatestAuditReport(): SecurityAuditReport | null {
    return this.vulnerabilityService.getLatestAuditReport();
  }

  /**
   * Update vulnerability status
   */
  updateVulnerabilityStatus(
    vulnerabilityId: string,
    status: SecurityVulnerability['status']
  ): boolean {
    return this.vulnerabilityService.updateVulnerabilityStatus(vulnerabilityId, status);
  }

  /**
   * Get security checks
   */
  getSecurityChecks(): SecurityCheck[] {
    return this.checkService.getSecurityChecks();
  }

  /**
   * Update security check
   */
  updateSecurityCheck(checkId: string, updates: Partial<SecurityCheck>): boolean {
    return this.checkService.updateSecurityCheck(checkId, updates);
  }

  /**
   * Get compliance status
   */
  getComplianceStatus(): {
    overall: 'compliant' | 'partial' | 'non_compliant';
    owasp: 'compliant' | 'partial' | 'non_compliant';
    pci: 'compliant' | 'partial' | 'non_compliant';
    gdpr: 'compliant' | 'partial' | 'non_compliant';
  } {
    const latestReport = this.getLatestAuditReport();
    if (!latestReport) {
      return {
        overall: 'non_compliant',
        owasp: 'non_compliant',
        pci: 'non_compliant',
        gdpr: 'non_compliant',
      };
    }

    return this.complianceService.getComplianceStatus(
      latestReport.compliance.owasp_top_10,
      latestReport.compliance.pci_dss,
      latestReport.compliance.gdpr
    );
  }
}
