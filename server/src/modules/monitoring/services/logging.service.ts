import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import * as winston from 'winston';
import * as DailyRotateFile from 'winston-daily-rotate-file';
import { Request, Response } from 'express';
import { loggingConfig } from '../../../config';
import { getClientIP } from '../../../common/utils/request.utils';

export interface LogContext {
    userId?: string;
    requestId?: string;
    correlationId?: string;
    ip?: string;
    userAgent?: string;
    method?: string;
    url?: string;
    statusCode?: number;
    responseTime?: number;
    operation?: string;
    service?: string;
    version?: string;
    environment?: string;
    [key: string]: any;
}

export interface ErrorLogContext extends LogContext {
    errorCode?: string;
    errorType?: string;
    stackTrace?: string;
    severity?: 'low' | 'medium' | 'high' | 'critical';
    component?: string;
    action?: string;
}

@Injectable()
export class LoggingService implements NestLoggerService {
    private readonly logger: winston.Logger;
    private readonly config = loggingConfig();

    constructor() {
        this.logger = this.createLogger();
    }

    private createLogger(): winston.Logger {
        const logFormat = winston.format.combine(
            winston.format.timestamp(),
            winston.format.errors({ stack: true }),
            winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp'] }),
            winston.format.json(),
        );

        const consoleFormat = winston.format.combine(
            winston.format.colorize(),
            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
                const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
                return `${timestamp} ${level}: ${message} ${metaStr}`;
            }),
        );

        const transports: winston.transport[] = [];

        // Console transport
        if (this.config.console.enabled) {
            transports.push(
                new winston.transports.Console({
                    level: this.config.level,
                    format: consoleFormat,
                }),
            );
        }

        // File transport with rotation
        if (this.config.file.enabled) {
            transports.push(
                new DailyRotateFile({
                    filename: `${this.config.file.path}/app-%DATE%.log`,
                    datePattern: this.config.file.datePattern,
                    maxSize: this.config.file.maxSize,
                    maxFiles: this.config.file.maxFiles,
                    format: logFormat,
                    level: this.config.level,
                }),
            );
        }

        return winston.createLogger({
            level: this.config.level,
            format: logFormat,
            transports,
            exceptionHandlers: [
                new winston.transports.File({
                    filename: `${this.config.file.path}/exceptions.log`,
                }),
            ],
            rejectionHandlers: [
                new winston.transports.File({
                    filename: `${this.config.file.path}/rejections.log`,
                }),
            ],
        });
    }

    // NestJS Logger Interface
    log(message: any, context?: string) {
        this.logger.info(message, { context });
    }

    error(message: any, stack?: string, context?: string) {
        this.logger.error(message, { stack, context });
    }

    warn(message: any, context?: string) {
        this.logger.warn(message, { context });
    }

    debug(message: any, context?: string) {
        this.logger.debug(message, { context });
    }

    verbose(message: any, context?: string) {
        this.logger.verbose(message, { context });
    }

    // Enhanced logging methods
    logInfo(message: string, context?: LogContext) {
        this.logger.info(message, context);
    }

    logErrorBasic(message: string, error?: Error, context?: LogContext) {
        this.logger.error(message, {
            error: error?.message,
            stack: error?.stack,
            ...context,
        });
    }

    logWarning(message: string, context?: LogContext) {
        this.logger.warn(message, context);
    }

    // Business metrics logging
    logBusinessMetric(metric: string, value: number, context?: LogContext) {
        this.logger.info('Business Metric', {
            metric,
            value,
            type: 'business_metric',
            ...context,
        });
    }

    logUserAction(action: string, context?: LogContext) {
        this.logger.info('User Action', {
            action,
            type: 'user_action',
            ...context,
        });
    }

    logSystemEvent(event: string, context?: LogContext) {
        this.logger.info('System Event', {
            event,
            type: 'system_event',
            ...context,
        });
    }

    // Request logging
    logRequest(req: Request, res: Response, responseTime: number) {
        // Skip request logging in production if disabled
        if (process.env.NODE_ENV === 'production' && !this.config.production.enableRequestLogging) {
            return;
        }

        const logData = {
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            responseTime,
            ip: getClientIP(req),
            userAgent: req.get('User-Agent'),
            userId: (req as any).user?.id,
            requestId: (req as any).requestId,
        };

        // Use different log levels based on response time and status
        let level = 'info';
        if (res.statusCode >= 500) {
            level = 'error';
        } else if (res.statusCode >= 400) {
            level = 'warn';
        } else if (responseTime > this.config.slowQueryThreshold) {
            level = 'warn';
        }

        const message = `${req.method} ${req.url} ${res.statusCode} - ${responseTime}ms`;
        this.logger.log(level, message, logData);
    }

    // Enhanced error logging
    logError(message: string, error: Error, context?: ErrorLogContext) {
        const errorContext: ErrorLogContext = {
            ...context,
            errorType: error.constructor.name,
            errorCode: (error as any).errorCode || 'UNKNOWN_ERROR',
            stackTrace: error.stack,
            severity: this.determineSeverity(error),
            component: context?.component || 'unknown',
            action: context?.action || 'unknown',
            service: 'genie-ai-server',
            version: process.env.npm_package_version || '1.0.0',
            environment: process.env.NODE_ENV || 'development',
        };

        this.logger.error(message, errorContext);
    }

    logSecurityEvent(event: string, context?: LogContext) {
        this.logger.warn('Security Event', {
            event,
            type: 'security_event',
            severity: 'high',
            service: 'genie-ai-server',
            ...context,
        });
    }

    logBusinessEvent(event: string, context?: LogContext) {
        this.logger.info('Business Event', {
            event,
            type: 'business_event',
            service: 'genie-ai-server',
            ...context,
        });
    }

    logPerformanceMetric(metric: string, value: number, context?: LogContext) {
        this.logger.info('Performance Metric', {
            metric,
            value,
            type: 'performance_metric',
            service: 'genie-ai-server',
            ...context,
        });
    }

    logAuditEvent(action: string, resource: string, context?: LogContext) {
        this.logger.info('Audit Event', {
            action,
            resource,
            type: 'audit_event',
            service: 'genie-ai-server',
            ...context,
        });
    }

    private determineSeverity(error: Error): 'low' | 'medium' | 'high' | 'critical' {
        const errorMessage = error.message.toLowerCase();
        const errorName = error.constructor.name.toLowerCase();

        // Critical errors
        if (
            errorMessage.includes('database') ||
            errorMessage.includes('connection') ||
            errorMessage.includes('memory') ||
            errorName.includes('outofmemory')
        ) {
            return 'critical';
        }

        // High severity errors
        if (
            errorMessage.includes('authentication') ||
            errorMessage.includes('authorization') ||
            errorMessage.includes('security') ||
            errorMessage.includes('payment') ||
            errorName.includes('unauthorized') ||
            errorName.includes('forbidden')
        ) {
            return 'high';
        }

        // Medium severity errors
        if (
            errorMessage.includes('validation') ||
            errorMessage.includes('timeout') ||
            errorMessage.includes('rate limit') ||
            errorName.includes('timeout')
        ) {
            return 'medium';
        }

        // Default to low severity
        return 'low';
    }

    // Structured logging for different components
    logAIServiceEvent(event: string, context?: LogContext) {
        this.logger.info('AI Service Event', {
            event,
            type: 'ai_service_event',
            component: 'ai_service',
            service: 'genie-ai-server',
            ...context,
        });
    }

    logPaymentEvent(event: string, context?: LogContext) {
        this.logger.info('Payment Event', {
            event,
            type: 'payment_event',
            component: 'payment_service',
            service: 'genie-ai-server',
            ...context,
        });
    }

    logDatabaseEvent(event: string, context?: LogContext) {
        this.logger.info('Database Event', {
            event,
            type: 'database_event',
            component: 'database',
            service: 'genie-ai-server',
            ...context,
        });
    }

    logCacheEvent(event: string, context?: LogContext) {
        this.logger.info('Cache Event', {
            event,
            type: 'cache_event',
            component: 'redis_cache',
            service: 'genie-ai-server',
            ...context,
        });
    }
}
