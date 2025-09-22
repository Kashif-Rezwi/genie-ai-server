import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { LoggingService } from '../services/logging.service';
import { PerformanceService } from '../services/performance.service';
import { MetricsService } from '../services/metrics.service';

@Injectable()
export class RequestMonitoringMiddleware implements NestMiddleware {
    constructor(
        private readonly loggingService: LoggingService,
        private readonly performanceService: PerformanceService,
        private readonly metricsService: MetricsService,
    ) { }

    use(req: Request, res: Response, next: NextFunction) {
        const startTime = Date.now();

        // Generate request ID for tracing
        const requestId = this.generateRequestId();
        (req as any).requestId = requestId;

        // Log request start
        this.loggingService.logInfo(`${req.method} ${req.url} - START`, {
            requestId,
            method: req.method,
            url: req.url,
            userAgent: req.get('User-Agent'),
            ip: this.getClientIP(req),
            userId: (req as any).user?.id,
        });

        // Override res.end to capture response data
        const originalEnd = res.end;
        res.end = function (chunk?: any, encoding?: any, cb?: any) {
            const responseTime = Date.now() - startTime;

            // Record performance metrics
            this.performanceService.recordRequest({
                responseTime,
                statusCode: res.statusCode,
                method: req.method,
                url: req.url,
            });

            // Record metrics
            this.metricsService.incrementCounter('http_requests_total', {
                method: req.method,
                status: res.statusCode.toString(),
                endpoint: this.getEndpointFromUrl(req.url),
            });

            this.metricsService.recordHistogram('http_request_duration_ms', responseTime, {
                method: req.method,
                status: res.statusCode.toString(),
            });

            // Log request completion
            this.loggingService.logRequest(req, res, responseTime);

            // Call original end method and return its result
            return originalEnd.call(res, chunk, encoding, cb);
        }.bind(this);

        next();
    }

    private generateRequestId(): string {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private getClientIP(req: Request): string {
        return (
            req.ip ||
            req.connection?.remoteAddress ||
            req.socket?.remoteAddress ||
            (req as any).headers?.['x-forwarded-for']?.split(',')[0] ||
            'unknown'
        );
    }

    private getEndpointFromUrl(url: string): string {
        // Extract endpoint pattern from URL (remove query params and IDs)
        return url
            .split('?')[0] // Remove query params
            .replace(/\/[0-9a-f-]{36}/g, '/:id') // Replace UUIDs with :id
            .replace(/\/\d+/g, '/:id') // Replace numeric IDs with :id
            .replace(/\/[^\/]+@[^\/]+/g, '/:email') // Replace emails with :email
            .substring(0, 100); // Limit length
    }
}