import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import * as winston from 'winston';
import * as DailyRotateFile from 'winston-daily-rotate-file';
import { Request, Response } from 'express';
import { loggingConfig } from '../../../config';
import { getClientIP } from '../../../common/utils/request.utils';

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
            winston.format.json()
        );

        const consoleFormat = winston.format.combine(
            winston.format.colorize(),
            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
                const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
                return `${timestamp} ${level}: ${message} ${metaStr}`;
            })
        );

        const transports: winston.transport[] = [];

        // Console transport
        if (this.config.console.enabled) {
            transports.push(
                new winston.transports.Console({
                    level: this.config.level,
                    format: consoleFormat,
                })
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
                })
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

    logError(message: string, error?: Error, context?: LogContext) {
        this.logger.error(message, {
            error: error?.message,
            stack: error?.stack,
            ...context,
        });
    }

    logWarning(message: string, context?: LogContext) {
        this.logger.warn(message, context);
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

}