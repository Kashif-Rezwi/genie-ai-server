import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { LoggingService } from '../services/logging.service';
import { MetricsService } from '../services/metrics.service';

@Injectable()
export class RequestMonitoringMiddleware implements NestMiddleware {
  constructor(
    private readonly loggingService: LoggingService,
    private readonly metricsService: MetricsService
  ) {}

  use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();

    // Generate request ID for tracing
    const requestId = this.generateRequestId();
    (req as any).requestId = requestId;

    // Add request ID to response headers for client correlation
    res.setHeader('X-Request-ID', requestId);

    // Override res.end to capture response data
    const originalEnd = res.end;
    const self = this;
    res.end = function (chunk?: any, encoding?: any, cb?: any) {
      const responseTime = Date.now() - startTime;

      // Record metrics
      self.metricsService.recordRequest(req.method, req.url, res.statusCode, responseTime);

      // Log request completion with enhanced context
      self.loggingService.logRequest(req, res, responseTime);

      // Call original end method and return its result
      return originalEnd.call(res, chunk, encoding, cb);
    };

    next();
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
