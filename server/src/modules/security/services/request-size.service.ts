import { Injectable, BadRequestException } from '@nestjs/common';
import { Request } from 'express';

export interface RequestSizeConfig {
  maxSize: number; // in bytes
  endpoint: string;
  method?: string;
}

@Injectable()
export class RequestSizeService {
  private readonly defaultMaxSize = 1024 * 1024; // 1MB
  private readonly endpointConfigs: Map<string, RequestSizeConfig> = new Map();

  constructor() {
    this.initializeEndpointConfigs();
  }

  /**
   * Check if request size is within limits for the endpoint
   */
  validateRequestSize(request: Request): void {
    const endpoint = this.getEndpointKey(request.path, request.method);
    const config = this.getConfigForEndpoint(endpoint);

    const contentLength = this.getContentLength(request);

    if (contentLength > config.maxSize) {
      throw new BadRequestException(
        `Request size ${contentLength} bytes exceeds maximum allowed size of ${config.maxSize} bytes for ${endpoint}`
      );
    }
  }

  /**
   * Get maximum allowed size for an endpoint
   */
  getMaxSizeForEndpoint(path: string, method: string = 'POST'): number {
    const endpoint = this.getEndpointKey(path, method);
    const config = this.getConfigForEndpoint(endpoint);
    return config.maxSize;
  }

  /**
   * Add custom size limit for an endpoint
   */
  addEndpointConfig(config: RequestSizeConfig): void {
    const key = this.getEndpointKey(config.endpoint, config.method || 'POST');
    this.endpointConfigs.set(key, config);
  }

  private initializeEndpointConfigs(): void {
    // Authentication endpoints - small payloads
    this.addEndpointConfig({
      endpoint: '/api/auth/login',
      method: 'POST',
      maxSize: 1024, // 1KB
    });

    this.addEndpointConfig({
      endpoint: '/api/auth/register',
      method: 'POST',
      maxSize: 2048, // 2KB
    });

    this.addEndpointConfig({
      endpoint: '/api/auth/reset-password',
      method: 'POST',
      maxSize: 1024, // 1KB
    });

    // AI endpoints - larger payloads for messages
    this.addEndpointConfig({
      endpoint: '/api/ai/generate',
      method: 'POST',
      maxSize: 50 * 1024, // 50KB
    });

    this.addEndpointConfig({
      endpoint: '/api/ai/stream',
      method: 'POST',
      maxSize: 50 * 1024, // 50KB
    });

    // Chat endpoints - medium payloads
    this.addEndpointConfig({
      endpoint: '/api/chat/message',
      method: 'POST',
      maxSize: 25 * 1024, // 25KB
    });

    this.addEndpointConfig({
      endpoint: '/api/chat/stream',
      method: 'POST',
      maxSize: 25 * 1024, // 25KB
    });

    // Payment endpoints - small payloads
    this.addEndpointConfig({
      endpoint: '/api/payments/create-order',
      method: 'POST',
      maxSize: 2048, // 2KB
    });

    this.addEndpointConfig({
      endpoint: '/api/payments/verify',
      method: 'POST',
      maxSize: 2048, // 2KB
    });

    // Webhook endpoints - small payloads
    this.addEndpointConfig({
      endpoint: '/api/payments/webhook',
      method: 'POST',
      maxSize: 10 * 1024, // 10KB
    });

    // File upload endpoints - larger payloads
    this.addEndpointConfig({
      endpoint: '/api/upload',
      method: 'POST',
      maxSize: 10 * 1024 * 1024, // 10MB
    });

    // Profile update endpoints - medium payloads
    this.addEndpointConfig({
      endpoint: '/api/user/profile',
      method: 'PUT',
      maxSize: 5 * 1024, // 5KB
    });

    this.addEndpointConfig({
      endpoint: '/api/user/profile',
      method: 'PATCH',
      maxSize: 5 * 1024, // 5KB
    });
  }

  private getEndpointKey(path: string, method: string): string {
    return `${method.toUpperCase()}:${path}`;
  }

  private getConfigForEndpoint(endpoint: string): RequestSizeConfig {
    // Try exact match first
    const config = this.endpointConfigs.get(endpoint);

    if (config) {
      return config;
    }

    // Try to find a pattern match
    for (const [key, endpointConfig] of this.endpointConfigs.entries()) {
      if (this.matchesPattern(endpoint, key)) {
        return endpointConfig;
      }
    }

    // Return default config
    return {
      endpoint,
      maxSize: this.defaultMaxSize,
    };
  }

  private matchesPattern(endpoint: string, pattern: string): boolean {
    // Simple pattern matching for endpoints with parameters
    const patternParts = pattern.split('/');
    const endpointParts = endpoint.split('/');

    if (patternParts.length !== endpointParts.length) {
      return false;
    }

    for (let i = 0; i < patternParts.length; i++) {
      const patternPart = patternParts[i];
      const endpointPart = endpointParts[i];

      // Skip method part
      if (patternPart.includes(':')) {
        continue;
      }

      // Check if parts match
      if (patternPart !== endpointPart && !patternPart.startsWith(':')) {
        return false;
      }
    }

    return true;
  }

  private getContentLength(request: Request): number {
    // Get content length from headers
    const contentLength = request.headers['content-length'];
    if (contentLength) {
      return parseInt(contentLength, 10);
    }

    // Estimate from body if available
    if (request.body) {
      const bodyString = JSON.stringify(request.body);
      return Buffer.byteLength(bodyString, 'utf8');
    }

    // Default to 0 if no content length available
    return 0;
  }
}
