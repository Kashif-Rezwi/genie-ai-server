import { Injectable } from '@nestjs/common';
import * as DOMPurify from 'isomorphic-dompurify';
import * as validator from 'validator';

export interface SanitizationOptions {
  maxLength?: number;
  allowHtml?: boolean;
  stripHtml?: boolean;
  allowedTags?: string[];
  allowedAttributes?: Record<string, string[]>;
  strictMode?: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  sanitizedValue: string;
  originalValue: string;
  errors: string[];
  warnings: string[];
}

@Injectable()
export class InputSanitizationService {
  private readonly defaultOptions: SanitizationOptions = {
    maxLength: 1000,
    allowHtml: false,
    stripHtml: true,
    allowedTags: [],
    allowedAttributes: {},
    strictMode: true,
  };

  /**
   * Sanitize text input with comprehensive XSS protection
   */
  sanitizeText(input: string, options: Partial<SanitizationOptions> = {}): ValidationResult {
    const opts = { ...this.defaultOptions, ...options };
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!input || typeof input !== 'string') {
      return {
        isValid: false,
        sanitizedValue: '',
        originalValue: input || '',
        errors: ['Input must be a non-empty string'],
        warnings: [],
      };
    }

    let sanitized = input;

    // Length validation
    if (sanitized.length > opts.maxLength!) {
      errors.push(`Input exceeds maximum length of ${opts.maxLength} characters`);
      sanitized = sanitized.substring(0, opts.maxLength);
    }

    // HTML sanitization
    if (opts.stripHtml) {
      sanitized = this.stripHtml(sanitized);
    } else if (opts.allowHtml) {
      sanitized = this.sanitizeHtml(sanitized, opts);
    }

    // XSS protection
    sanitized = this.preventXSS(sanitized);

    // SQL injection prevention
    sanitized = this.preventSQLInjection(sanitized);

    // Additional security checks
    if (this.containsSuspiciousPatterns(sanitized)) {
      warnings.push('Input contains potentially suspicious patterns');
    }

    return {
      isValid: errors.length === 0,
      sanitizedValue: sanitized.trim(),
      originalValue: input,
      errors,
      warnings,
    };
  }

  /**
   * Sanitize email input
   */
  sanitizeEmail(email: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!email || typeof email !== 'string') {
      return {
        isValid: false,
        sanitizedValue: '',
        originalValue: email || '',
        errors: ['Email must be a non-empty string'],
        warnings: [],
      };
    }

    const sanitized = email.toLowerCase().trim();

    if (!validator.isEmail(sanitized)) {
      errors.push('Invalid email format');
    }

    if (sanitized.length > 254) {
      errors.push('Email exceeds maximum length of 254 characters');
    }

    // Check for suspicious patterns
    if (this.containsSuspiciousPatterns(sanitized)) {
      warnings.push('Email contains potentially suspicious patterns');
    }

    return {
      isValid: errors.length === 0,
      sanitizedValue: sanitized,
      originalValue: email,
      errors,
      warnings,
    };
  }

  /**
   * Sanitize URL input
   */
  sanitizeUrl(url: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!url || typeof url !== 'string') {
      return {
        isValid: false,
        sanitizedValue: '',
        originalValue: url || '',
        errors: ['URL must be a non-empty string'],
        warnings: [],
      };
    }

    const sanitized = url.trim();

    if (!validator.isURL(sanitized, { protocols: ['http', 'https'] })) {
      errors.push('Invalid URL format');
    }

    // Check for suspicious domains
    if (this.isSuspiciousDomain(sanitized)) {
      warnings.push('URL points to a potentially suspicious domain');
    }

    return {
      isValid: errors.length === 0,
      sanitizedValue: sanitized,
      originalValue: url,
      errors,
      warnings,
    };
  }

  /**
   * Sanitize JSON input
   */
  sanitizeJson(input: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const sanitized = this.deepSanitizeObject(input);
      return {
        isValid: true,
        sanitizedValue: JSON.stringify(sanitized),
        originalValue: JSON.stringify(input),
        errors: [],
        warnings,
      };
    } catch (error) {
      return {
        isValid: false,
        sanitizedValue: '{}',
        originalValue: JSON.stringify(input),
        errors: ['Invalid JSON input'],
        warnings: [],
      };
    }
  }

  /**
   * Sanitize file upload metadata
   */
  sanitizeFileMetadata(metadata: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!metadata || typeof metadata !== 'object') {
      return {
        isValid: false,
        sanitizedValue: '{}',
        originalValue: JSON.stringify(metadata),
        errors: ['File metadata must be an object'],
        warnings: [],
      };
    }

    const sanitized: any = {};

    // Sanitize filename
    if (metadata.filename && typeof metadata.filename === 'string') {
      const filenameResult = this.sanitizeText(metadata.filename, { maxLength: 255 });
      if (filenameResult.isValid) {
        sanitized.filename = filenameResult.sanitizedValue;
      } else {
        errors.push(...filenameResult.errors);
      }
    }

    // Sanitize mimetype
    if (metadata.mimetype && typeof metadata.mimetype === 'string') {
      const mimetypeResult = this.sanitizeText(metadata.mimetype, { maxLength: 100 });
      if (mimetypeResult.isValid) {
        sanitized.mimetype = mimetypeResult.sanitizedValue;
      } else {
        errors.push(...mimetypeResult.errors);
      }
    }

    // Sanitize size
    if (metadata.size && typeof metadata.size === 'number') {
      if (metadata.size > 0 && metadata.size < 100 * 1024 * 1024) {
        // 100MB max
        sanitized.size = metadata.size;
      } else {
        errors.push('File size must be between 0 and 100MB');
      }
    }

    return {
      isValid: errors.length === 0,
      sanitizedValue: JSON.stringify(sanitized),
      originalValue: JSON.stringify(metadata),
      errors,
      warnings,
    };
  }

  private stripHtml(input: string): string {
    return input.replace(/<[^>]*>/g, '');
  }

  private sanitizeHtml(input: string, options: SanitizationOptions): string {
    const config = {
      ALLOWED_TAGS: options.allowedTags || [],
      ALLOWED_ATTR: Object.keys(options.allowedAttributes || {}),
      ALLOW_DATA_ATTR: false,
    };

    return DOMPurify.sanitize(input, config);
  }

  private preventXSS(input: string): string {
    return input
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
      .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '');
  }

  private preventSQLInjection(input: string): string {
    return input
      .replace(/[';\\-\\*\\/\\|\\&%]/g, '')
      .replace(/(union|select|insert|update|delete|drop|create|alter|exec|execute)/gi, '');
  }

  private containsSuspiciousPatterns(input: string): boolean {
    const suspiciousPatterns = [
      /<script/i,
      /javascript:/i,
      /vbscript:/i,
      /onload/i,
      /onerror/i,
      /onclick/i,
      /onmouseover/i,
      /eval\s*\(/i,
      /expression\s*\(/i,
      /url\s*\(/i,
      /@import/i,
      /<iframe/i,
      /<object/i,
      /<embed/i,
    ];

    return suspiciousPatterns.some(pattern => pattern.test(input));
  }

  private isSuspiciousDomain(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const suspiciousDomains = ['localhost', '127.0.0.1', '0.0.0.0', 'file://', 'ftp://', 'data:'];

      return suspiciousDomains.some(
        domain => urlObj.hostname.includes(domain) || urlObj.protocol.includes(domain)
      );
    } catch {
      return true;
    }
  }

  private deepSanitizeObject(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'string') {
      return this.sanitizeText(obj).sanitizedValue;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.deepSanitizeObject(item));
    }

    if (typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        const sanitizedKey = this.sanitizeText(key, { maxLength: 100 }).sanitizedValue;
        sanitized[sanitizedKey] = this.deepSanitizeObject(value);
      }
      return sanitized;
    }

    return obj;
  }
}
