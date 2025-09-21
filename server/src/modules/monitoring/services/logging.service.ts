import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import * as winston from 'winston';
import * as DailyRotateFile from 'winston-daily-rotate-file';
import { Request, Response } from 'express';

export interface LogContext {
    userId?: string;
    requestId?: string;
    ip?: string;
    userAgent?: string;
    method?: string;
    url?: string;
    statusCode?: number;
    responseTime?: number;
    [key: string]: any;
}

export interface ErrorLogData {
    error: Error;
    context?: LogContext;
    stack?: string;
    additionalInfo?: Record<string, any>;
}

@Injectable()
export class LoggingService implements NestLoggerService {
    private readonly logger: winston.Logger;
    private readonly requestLogger: winston.Logger;
    private readonly errorLogger: winston.Logger;
    private readonly securityLogger: winston.Logger;

    constructor() {
        this.logger = this.createLogger('app');
        this.requestLogger = this.createLogger('requests');
        this.errorLogger = this.createLogger('errors');
        this.securityLogger = this.createLogger('security');
    }

    private createLogger(category: string): winston.Logger {
        const logFormat = winston.format.combine(
            winston.format.timestamp(),
            winston.format.errors({ stack: true }),
            winston.format.json(),
            winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
                const logEntry = {
                    timestamp,
                    level,
                    category,
                    message,
                    ...(stack && { stack }),
                    ...meta,
                };
                return JSON.stringify(logEntry);
            })
        );

        const consoleFormat = winston.format.combine(
            winston.format.colorize(),
            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            winston.format.printf(({ timestamp, level, message, category: cat, ...meta }) => {
                const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
                const catStr = typeof cat === 'string' ? cat.toUpperCase() : String(cat ?? '').toUpperCase();
                return `${timestamp} [${catStr}] ${level}: ${message} ${metaStr}`;
            })
        );

        const transports: winston.transport[] = [];

        // Console transport
        if (process.env.LOG_CONSOLE_ENABLED === 'true') {
            transports.push(
                new winston.transports.Console({
                    level: process.env.LOG_LEVEL || 'info',
                    format: consoleFormat,
                })
            );
        }

        // File transports
        if (process.env.LOG_FILE_ENABLED === 'true') {
            // General logs
            transports.push(
                new DailyRotateFile({
                    filename: `${process.env.LOG_FILE_PATH}/${category}-%DATE%.log`,
                    datePattern: process.env.LOG_DATE_PATTERN || 'YYYY-MM-DD',
                    maxSize: process.env.LOG_MAX_SIZE || '20m',
                    maxFiles: process.env.LOG_MAX_FILES || '14d',
                    format: logFormat,
                    level: process.env.LOG_LEVEL || 'info',
                })
            );

            // Error logs
            if (category === 'errors' || category === 'app') {
                transports.push(
                    new DailyRotateFile({
                        filename: `${process.env.LOG_FILE_PATH}/error-%DATE%.log`,
                        datePattern: process.env.LOG_DATE_PATTERN || 'YYYY-MM-DD',
                        maxSize: process.env.LOG_MAX_SIZE || '20m',
                        maxFiles: process.env.LOG_MAX_FILES || '14d',
                        format: logFormat,
                        level: 'error',
                    })
                );
            }
        }

        return winston.createLogger({
            level: process.env.LOG_LEVEL || 'info',
            format: logFormat,
            transports,
            exceptionHandlers: [
                new winston.transports.File({
                    filename: `${process.env.LOG_FILE_PATH}/exceptions.log`,
                }),
            ],
            rejectionHandlers: [
                new winston.transports.File({
                    filename: `${process.env.LOG_FILE_PATH}/rejections.log`,
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

    logError(message: string, errorData?: ErrorLogData) {
        this.errorLogger.error(message, {
            error: errorData?.error?.message,
            stack: errorData?.error?.stack,
            ...errorData?.context,
            ...errorData?.additionalInfo,
        });
    }

    logWarning(message: string, context?: LogContext) {
        this.logger.warn(message, context);
    }

    logDebug(message: string, context?: LogContext) {
        this.logger.debug(message, context);
    }

    // Request logging
    logRequest(req: Request, res: Response, responseTime: number) {
        const logData = {
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            responseTime,
            ip: this.getClientIP(req),
            userAgent: req.get('User-Agent'),
            userId: (req as any).user?.id,
            requestId: (req as any).requestId,
            contentLength: res.get('Content-Length'),
            referer: req.get('Referer'),
        };

        const level = res.statusCode >= 400 ? 'warn' : 'info';
        const message = `${req.method} ${req.url} ${res.statusCode} - ${responseTime}ms`;

        this.requestLogger.log(level, message, logData);
    }

    // Security logging
    logSecurityEvent(event: string, context: LogContext) {
        this.securityLogger.warn(`SECURITY: ${event}`, {
            event,
            ...context,
            timestamp: new Date().toISOString(),
        });
    }

    // Business logic logging
    logBusinessEvent(event: string, data: Record<string, any>) {
        this.logger.info(`BUSINESS: ${event}`, {
            event,
            ...data,
            timestamp: new Date().toISOString(),
        });
    }

    // Performance logging
    logPerformance(operation: string, duration: number, context?: LogContext) {
        const level = duration > 5000 ? 'warn' : 'info';
        this.logger.log(level, `PERFORMANCE: ${operation} took ${duration}ms`, {
            operation,
            duration,
            ...context,
        });
    }

    // Database query logging
    logSlowQuery(query: string, duration: number, parameters?: any[]) {
        if (duration > parseInt(process.env.SLOW_QUERY_THRESHOLD || '1000')) {
            this.logger.warn(`SLOW QUERY: ${duration}ms`, {
                query: query.substring(0, 500), // Truncate long queries
                duration,
                parameters: parameters?.length ? parameters.slice(0, 10) : undefined, // Limit params
            });
        }
    }

    // AI-specific logging
    logAIInteraction(event: string, data: {
        userId: string;
        model: string;
        tokensUsed: number;
        creditsUsed: number;
        responseTime: number;
        success: boolean;
    }) {
        this.logger.info(`AI: ${event}`, {
            event,
            ...data,
            timestamp: new Date().toISOString(),
        });
    }

    // Payment logging
    logPaymentEvent(event: string, data: {
        userId: string;
        paymentId: string;
        amount: number;
        status: string;
        method?: string;
    }) {
        this.logger.info(`PAYMENT: ${event}`, {
            event,
            ...data,
            timestamp: new Date().toISOString(),
        });
    }

    // Credit operations logging
    logCreditOperation(event: string, data: {
        userId: string;
        amount: number;
        type: string;
        balance: number;
        description: string;
    }) {
        this.logger.info(`CREDITS: ${event}`, {
            event,
            ...data,
            timestamp: new Date().toISOString(),
        });
    }

    // Helper methods
    private getClientIP(req: Request): string {
        return (
            req.ip ||
            req.connection?.remoteAddress ||
            req.socket?.remoteAddress ||
            (req as any).headers?.['x-forwarded-for']?.split(',')[0] ||
            'unknown'
        );
    }

    // Log aggregation methods
    async getLogStats(hours: number = 24): Promise<{
        totalLogs: number;
        errorCount: number;
        warningCount: number;
        requestCount: number;
        averageResponseTime: number;
    }> {
        // In a real implementation, this would query log files or log database
        // For now, return mock data
        return {
            totalLogs: 1500,
            errorCount: 25,
            warningCount: 150,
            requestCount: 1200,
            averageResponseTime: 245,
        };
    }

    // Get recent errors
    async getRecentErrors(limit: number = 50): Promise<any[]> {
        // In a real implementation, this would read from error log files
        return [];
    }

    // Search logs
    async searchLogs(query: string, startTime?: Date, endTime?: Date): Promise<any[]> {
        // In a real implementation, this would search through log files
        return [];
    }
}