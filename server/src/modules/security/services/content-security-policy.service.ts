import { Injectable, Logger } from '@nestjs/common';

export interface CSPDirective {
  'default-src'?: string[];
  'script-src'?: string[];
  'style-src'?: string[];
  'img-src'?: string[];
  'font-src'?: string[];
  'connect-src'?: string[];
  'media-src'?: string[];
  'object-src'?: string[];
  'child-src'?: string[];
  'frame-src'?: string[];
  'worker-src'?: string[];
  'frame-ancestors'?: string[];
  'form-action'?: string[];
  'base-uri'?: string[];
  'manifest-src'?: string[];
  'upgrade-insecure-requests'?: boolean;
  'block-all-mixed-content'?: boolean;
  'require-trusted-types-for'?: string[];
  'trusted-types'?: string[];
}

export interface CSPConfig {
  directives: CSPDirective;
  reportOnly?: boolean;
  reportUri?: string;
  upgradeInsecureRequests?: boolean;
  blockAllMixedContent?: boolean;
}

/**
 * Content Security Policy Service
 * Manages CSP headers and configurations
 */
@Injectable()
export class ContentSecurityPolicyService {
  private readonly logger = new Logger(ContentSecurityPolicyService.name);

  // Default CSP configurations for different environments
  private readonly defaultConfigs: Record<string, CSPConfig> = {
    development: {
      directives: {
        'default-src': ["'self'"],
        'script-src': [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-eval'", // Allow eval in development
          'https://cdn.jsdelivr.net',
          'https://unpkg.com',
        ],
        'style-src': [
          "'self'",
          "'unsafe-inline'",
          'https://fonts.googleapis.com',
          'https://cdn.jsdelivr.net',
        ],
        'img-src': ["'self'", 'data:', 'https:', 'blob:'],
        'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
        'connect-src': ["'self'", 'ws://localhost:*', 'wss://localhost:*', 'https://api.*'],
        'media-src': ["'self'", 'data:', 'blob:'],
        'object-src': ["'none'"],
        'child-src': ["'self'", 'blob:'],
        'frame-src': ["'none'"],
        'worker-src': ["'self'", 'blob:'],
        'frame-ancestors': ["'none'"],
        'form-action': ["'self'"],
        'base-uri': ["'self'"],
        'manifest-src': ["'self'"],
        'upgrade-insecure-requests': true,
        'block-all-mixed-content': true,
      },
      reportOnly: true,
    },
    production: {
      directives: {
        'default-src': ["'self'"],
        'script-src': [
          "'self'",
          "'strict-dynamic'",
          'https://cdn.jsdelivr.net',
          'https://unpkg.com',
        ],
        'style-src': [
          "'self'",
          "'unsafe-inline'",
          'https://fonts.googleapis.com',
          'https://cdn.jsdelivr.net',
        ],
        'img-src': ["'self'", 'data:', 'https://secure.gravatar.com', 'https://api.dicebear.com'],
        'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
        'connect-src': ["'self'", 'https://api.*', 'wss://api.*'],
        'media-src': ["'self'", 'data:', 'blob:'],
        'object-src': ["'none'"],
        'child-src': ["'self'", 'blob:'],
        'frame-src': ["'none'"],
        'worker-src': ["'self'", 'blob:'],
        'frame-ancestors': ["'none'"],
        'form-action': ["'self'"],
        'base-uri': ["'self'"],
        'manifest-src': ["'self'"],
        'upgrade-insecure-requests': true,
        'block-all-mixed-content': true,
        'require-trusted-types-for': ["'script'"],
        'trusted-types': ["'none'", 'default'],
      },
      reportOnly: false,
    },
    api: {
      directives: {
        'default-src': ["'none'"],
        'script-src': ["'none'"],
        'style-src': ["'none'"],
        'img-src': ["'none'"],
        'font-src': ["'none'"],
        'connect-src': ["'self'"],
        'media-src': ["'none'"],
        'object-src': ["'none'"],
        'child-src': ["'none'"],
        'frame-src': ["'none'"],
        'worker-src': ["'none'"],
        'frame-ancestors': ["'none'"],
        'form-action': ["'none'"],
        'base-uri': ["'none'"],
        'manifest-src': ["'none'"],
        'upgrade-insecure-requests': true,
        'block-all-mixed-content': true,
      },
      reportOnly: false,
    },
  };

  /**
   * Get CSP header value
   * @param environment - Environment (development, production, api)
   * @param customConfig - Custom CSP configuration
   * @returns string - CSP header value
   */
  getCSPHeader(environment: string = 'production', customConfig?: Partial<CSPConfig>): string {
    try {
      const baseConfig = this.defaultConfigs[environment] || this.defaultConfigs.production;
      const config = this.mergeConfigs(baseConfig, customConfig);

      const directives = this.buildDirectives(config.directives);
      const header = this.buildHeader(directives, config);

      return header;
    } catch (error) {
      this.logger.error(`Get CSP header error for environment ${environment}:`, error);
      return this.getFallbackCSP();
    }
  }

  /**
   * Get CSP report-only header
   * @param environment - Environment
   * @param reportUri - Report URI
   * @returns string - CSP report-only header
   */
  getCSPReportOnlyHeader(environment: string = 'production', reportUri?: string): string {
    try {
      const baseConfig = this.defaultConfigs[environment] || this.defaultConfigs.production;
      const config = {
        ...baseConfig,
        reportOnly: true,
        reportUri: reportUri || '/api/security/csp-report',
      };

      const directives = this.buildDirectives(config.directives);
      const header = this.buildHeader(directives, config);

      return header;
    } catch (error) {
      this.logger.error(`Get CSP report-only header error:`, error);
      return this.getFallbackCSP();
    }
  }

  /**
   * Validate CSP directive
   * @param directive - Directive name
   * @param values - Directive values
   * @returns boolean - Whether directive is valid
   */
  validateDirective(directive: string, values: string[]): boolean {
    const validDirectives = [
      'default-src',
      'script-src',
      'style-src',
      'img-src',
      'font-src',
      'connect-src',
      'media-src',
      'object-src',
      'child-src',
      'frame-src',
      'worker-src',
      'frame-ancestors',
      'form-action',
      'base-uri',
      'manifest-src',
      'upgrade-insecure-requests',
      'block-all-mixed-content',
      'require-trusted-types-for',
      'trusted-types',
    ];

    if (!validDirectives.includes(directive)) {
      return false;
    }

    // Validate values based on directive type
    switch (directive) {
      case 'upgrade-insecure-requests':
      case 'block-all-mixed-content':
        return values.length === 0;
      case 'require-trusted-types-for':
        return values.every(v => ['script', 'style'].includes(v));
      default:
        return this.validateSourceValues(values);
    }
  }

  /**
   * Get CSP violation report handler
   * @returns Function - CSP violation report handler
   */
  getCSPViolationHandler() {
    return (req: any, res: any, next: any) => {
      if (req.method === 'POST' && req.path === '/api/security/csp-report') {
        let body = '';

        req.on('data', (chunk: Buffer) => {
          body += chunk.toString();
        });

        req.on('end', () => {
          try {
            const report = JSON.parse(body);
            this.handleCSPViolation(report);
            res.status(204).send();
          } catch (error) {
            this.logger.error('CSP violation report parsing error:', error);
            res.status(400).send();
          }
        });
      } else {
        next();
      }
    };
  }

  /**
   * Build directives string
   * @param directives - CSP directives
   * @returns string - Directives string
   */
  private buildDirectives(directives: CSPDirective): string {
    const parts: string[] = [];

    for (const [directive, values] of Object.entries(directives)) {
      if (values === undefined || values === null) {
        continue;
      }

      if (typeof values === 'boolean') {
        if (values) {
          parts.push(directive);
        }
      } else if (Array.isArray(values) && values.length > 0) {
        const validValues = values.filter(value => this.validateSourceValue(value));
        if (validValues.length > 0) {
          parts.push(`${directive} ${validValues.join(' ')}`);
        }
      }
    }

    return parts.join('; ');
  }

  /**
   * Build CSP header
   * @param directives - Directives string
   * @param config - CSP configuration
   * @returns string - CSP header
   */
  private buildHeader(directives: string, config: CSPConfig): string {
    const parts = [directives];

    if (config.reportUri) {
      parts.push(`report-uri ${config.reportUri}`);
    }

    const headerName = config.reportOnly
      ? 'Content-Security-Policy-Report-Only'
      : 'Content-Security-Policy';
    return `${headerName}: ${parts.join('; ')}`;
  }

  /**
   * Merge configurations
   * @param base - Base configuration
   * @param custom - Custom configuration
   * @returns CSPConfig - Merged configuration
   */
  private mergeConfigs(base: CSPConfig, custom?: Partial<CSPConfig>): CSPConfig {
    if (!custom) {
      return base;
    }

    return {
      ...base,
      ...custom,
      directives: {
        ...base.directives,
        ...custom.directives,
      },
    };
  }

  /**
   * Validate source values
   * @param values - Source values
   * @returns boolean - Whether values are valid
   */
  private validateSourceValues(values: string[]): boolean {
    return values.every(value => this.validateSourceValue(value));
  }

  /**
   * Validate source value
   * @param value - Source value
   * @returns boolean - Whether value is valid
   */
  private validateSourceValue(value: string): boolean {
    const validSources = [
      "'self'",
      "'unsafe-inline'",
      "'unsafe-eval'",
      "'unsafe-hashes'",
      "'strict-dynamic'",
      "'none'",
      'data:',
      'blob:',
      'mediastream:',
      'filesystem:',
      'https:',
      'http:',
      'ws:',
      'wss:',
    ];

    // Check for quoted values
    if (validSources.includes(value)) {
      return true;
    }

    // Check for wildcard patterns
    if (value.includes('*')) {
      return /^https?:\/\/[^*]+\*[^*]*$/.test(value) || /^[^*]+\*[^*]*$/.test(value);
    }

    // Check for specific domains
    if (value.startsWith('https://') || value.startsWith('http://')) {
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    }

    // Check for localhost patterns
    if (value.includes('localhost')) {
      return /^(https?:\/\/)?localhost(:\d+)?(\/.*)?$/.test(value);
    }

    return false;
  }

  /**
   * Handle CSP violation
   * @param report - CSP violation report
   * @returns void
   */
  private handleCSPViolation(report: any): void {
    try {
      const violation = {
        timestamp: new Date().toISOString(),
        userAgent: report['user-agent'] || 'Unknown',
        blockedUri: report['blocked-uri'] || 'Unknown',
        violatedDirective: report['violated-directive'] || 'Unknown',
        originalPolicy: report['original-policy'] || 'Unknown',
        referrer: report.referrer || 'Unknown',
        sourceFile: report['source-file'] || 'Unknown',
        lineNumber: report['line-number'] || 0,
        columnNumber: report['column-number'] || 0,
      };

      this.logger.warn('CSP Violation detected:', violation);

      // In production, you would send this to a monitoring service
      // For now, we just log it
    } catch (error) {
      this.logger.error('CSP violation handling error:', error);
    }
  }

  /**
   * Get fallback CSP
   * @returns string - Fallback CSP header
   */
  private getFallbackCSP(): string {
    return "Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests; block-all-mixed-content";
  }
}
