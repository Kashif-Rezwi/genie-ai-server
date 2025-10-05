import { Injectable, Logger } from '@nestjs/common';
import { SecurityVulnerability } from './security-vulnerability.service';

@Injectable()
export class SecurityComplianceService {
  private readonly logger = new Logger(SecurityComplianceService.name);

  /**
   * Calculate overall security score
   */
  calculateOverallScore(vulnerabilityCounts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
    total: number;
  }): number {
    const weights = {
      critical: 10,
      high: 7,
      medium: 4,
      low: 2,
      info: 1,
    };

    const weightedScore = 
      vulnerabilityCounts.critical * weights.critical +
      vulnerabilityCounts.high * weights.high +
      vulnerabilityCounts.medium * weights.medium +
      vulnerabilityCounts.low * weights.low +
      vulnerabilityCounts.info * weights.info;

    // Convert to 0-100 scale (lower is better)
    const maxPossibleScore = 100;
    const score = Math.max(0, maxPossibleScore - weightedScore);
    
    this.logger.log(`Calculated overall security score: ${score}`);
    return Math.round(score);
  }

  /**
   * Calculate OWASP Top 10 compliance score
   */
  calculateOWASPScore(vulnerabilities: SecurityVulnerability[]): number {
    const owaspCategories = [
      'injection',
      'broken_authentication',
      'sensitive_data_exposure',
      'xml_external_entities',
      'broken_access_control',
      'security_misconfiguration',
      'cross_site_scripting',
      'insecure_deserialization',
      'known_vulnerabilities',
      'insufficient_logging',
    ];

    const owaspVulnerabilities = vulnerabilities.filter(vuln => 
      owaspCategories.some(category => 
        vuln.title.toLowerCase().includes(category) ||
        vuln.description.toLowerCase().includes(category)
      )
    );

    const criticalHighCount = owaspVulnerabilities.filter(v => 
      v.type === 'critical' || v.type === 'high'
    ).length;

    // Score based on critical/high OWASP vulnerabilities
    if (criticalHighCount === 0) return 100;
    if (criticalHighCount <= 2) return 80;
    if (criticalHighCount <= 5) return 60;
    if (criticalHighCount <= 10) return 40;
    return 20;
  }

  /**
   * Calculate PCI DSS compliance score
   */
  calculatePCIDSSScore(vulnerabilities: SecurityVulnerability[]): number {
    const pciCategories = [
      'authentication',
      'authorization',
      'data_protection',
      'network',
      'configuration',
    ];

    const pciVulnerabilities = vulnerabilities.filter(vuln => 
      pciCategories.includes(vuln.category)
    );

    const criticalHighCount = pciVulnerabilities.filter(v => 
      v.type === 'critical' || v.type === 'high'
    ).length;

    // PCI DSS requires zero critical/high vulnerabilities
    if (criticalHighCount === 0) return 100;
    if (criticalHighCount <= 1) return 60;
    if (criticalHighCount <= 3) return 30;
    return 0;
  }

  /**
   * Calculate GDPR compliance score
   */
  calculateGDPRScore(vulnerabilities: SecurityVulnerability[]): number {
    const gdprCategories = [
      'data_protection',
      'authentication',
      'authorization',
    ];

    const gdprVulnerabilities = vulnerabilities.filter(vuln => 
      gdprCategories.includes(vuln.category)
    );

    const criticalHighCount = gdprVulnerabilities.filter(v => 
      v.type === 'critical' || v.type === 'high'
    ).length;

    // GDPR compliance based on data protection vulnerabilities
    if (criticalHighCount === 0) return 100;
    if (criticalHighCount <= 1) return 80;
    if (criticalHighCount <= 3) return 60;
    if (criticalHighCount <= 5) return 40;
    return 20;
  }

  /**
   * Generate compliance recommendations
   */
  generateComplianceRecommendations(
    owaspScore: number,
    pciScore: number,
    gdprScore: number,
  ): string[] {
    const recommendations: string[] = [];

    if (owaspScore < 80) {
      recommendations.push('Address OWASP Top 10 vulnerabilities to improve security posture');
    }

    if (pciScore < 100) {
      recommendations.push('Resolve critical and high-severity vulnerabilities for PCI DSS compliance');
    }

    if (gdprScore < 80) {
      recommendations.push('Strengthen data protection measures for GDPR compliance');
    }

    if (recommendations.length === 0) {
      recommendations.push('Maintain current security practices and regular monitoring');
    }

    return recommendations;
  }

  /**
   * Get compliance status
   */
  getComplianceStatus(
    owaspScore: number,
    pciScore: number,
    gdprScore: number,
  ): {
    overall: 'compliant' | 'partial' | 'non_compliant';
    owasp: 'compliant' | 'partial' | 'non_compliant';
    pci: 'compliant' | 'partial' | 'non_compliant';
    gdpr: 'compliant' | 'partial' | 'non_compliant';
  } {
    const getStatus = (score: number): 'compliant' | 'partial' | 'non_compliant' => {
      if (score >= 80) return 'compliant';
      if (score >= 60) return 'partial';
      return 'non_compliant';
    };

    const owasp = getStatus(owaspScore);
    const pci = getStatus(pciScore);
    const gdpr = getStatus(gdprScore);

    // Overall status based on worst performing standard
    const scores = [owaspScore, pciScore, gdprScore];
    const minScore = Math.min(...scores);
    const overall = getStatus(minScore);

    return { overall, owasp, pci, gdpr };
  }
}
