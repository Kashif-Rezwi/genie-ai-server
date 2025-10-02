import { Injectable } from '@nestjs/common';
import { appConfig } from '../../config';

export interface LogData {
    level: 'debug' | 'info' | 'warn' | 'error';
    service: string;
    message: string;
    data?: Record<string, any>;
    timestamp?: string;
}

@Injectable()
export class LoggerService {
    private readonly config = appConfig();

    private formatLog(logData: LogData): string {
        const timestamp = logData.timestamp || new Date().toISOString();
        const baseLog = {
            timestamp,
            level: logData.level,
            service: logData.service,
            message: logData.message,
            ...(logData.data && { data: logData.data }),
        };

        return this.config.nodeEnv === 'production' 
            ? JSON.stringify(baseLog)
            : `[${timestamp}] ${logData.level.toUpperCase()} [${logData.service}] ${logData.message}${logData.data ? ' ' + JSON.stringify(logData.data, null, 2) : ''}`;
    }

    debug(service: string, message: string, data?: Record<string, any>): void {
        console.log(this.formatLog({
            level: 'debug',
            service,
            message,
            data,
        }));
    }

    info(service: string, message: string, data?: Record<string, any>): void {
        console.log(this.formatLog({
            level: 'info',
            service,
            message,
            data,
        }));
    }

    warn(service: string, message: string, data?: Record<string, any>): void {
        console.warn(this.formatLog({
            level: 'warn',
            service,
            message,
            data,
        }));
    }

    error(service: string, message: string, data?: Record<string, any>): void {
        console.error(this.formatLog({
            level: 'error',
            service,
            message,
            data,
        }));
    }

    // Security-specific logging
    security(event: string, data: Record<string, any>): void {
        this.info('security', event, data);
    }

    // Performance logging
    performance(operation: string, duration: number, data?: Record<string, any>): void {
        this.info('performance', `${operation} completed in ${duration}ms`, data);
    }
}
