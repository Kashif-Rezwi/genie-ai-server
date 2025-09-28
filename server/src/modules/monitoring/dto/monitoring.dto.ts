import {
    IsString,
    IsOptional,
    IsEnum,
    IsNumber,
    IsArray,
    IsBoolean,
    Min,
    Max,
} from 'class-validator';

export class LogTestDto {
    @IsEnum(['info', 'warn', 'error', 'debug'])
    level: 'info' | 'warn' | 'error' | 'debug';

    @IsString()
    message: string;
}

export class CustomAlertDto {
    @IsString()
    title: string;

    @IsString()
    message: string;

    @IsOptional()
    @IsEnum(['low', 'medium', 'high', 'critical'])
    severity?: 'low' | 'medium' | 'high' | 'critical';

    @IsOptional()
    @IsArray()
    channels?: string[];
}

export class UpdateAlertRuleDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsNumber()
    @Min(0)
    threshold?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    window?: number;

    @IsOptional()
    @IsEnum(['low', 'medium', 'high', 'critical'])
    severity?: 'low' | 'medium' | 'high' | 'critical';

    @IsOptional()
    @IsArray()
    channels?: string[];

    @IsOptional()
    @IsBoolean()
    enabled?: boolean;

    @IsOptional()
    @IsNumber()
    @Min(0)
    cooldown?: number;
}

export class TimeRangeQueryDto {
    @IsOptional()
    @IsNumber()
    @Min(60000) // Minimum 1 minute
    @Max(604800000) // Maximum 7 days
    timeRange?: number;
}

export class LimitQueryDto {
    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(1000)
    limit?: number;
}

export class ErrorSearchDto {
    @IsString()
    q: string;

    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(500)
    limit?: number;
}

export interface HealthStatusResponse {
    status: 'ok' | 'error';
    timestamp: Date;
    uptime: number;
    version: string;
    environment: string;
    services: Record<
        string,
        {
            status: 'healthy' | 'unhealthy' | 'degraded';
            responseTime?: number;
            lastChecked: Date;
            error?: string;
        }
    >;
}

export interface PerformanceMetricsResponse {
    requests: {
        total: number;
        successful: number;
        failed: number;
        averageResponseTime: number;
        p95ResponseTime: number;
        p99ResponseTime: number;
    };
    database: {
        queryCount: number;
        averageQueryTime: number;
        slowQueries: number;
    };
    memory: {
        heapUsed: number;
        heapTotal: number;
        usagePercentage: number;
    };
    errors: {
        rate: number;
        count: number;
    };
}

export interface ErrorSummaryResponse {
    totalErrors: number;
    errorRate: number;
    topErrors: Array<{
        fingerprint: string;
        message: string;
        count: number;
        lastSeen: Date;
    }>;
    errorsByType: Record<string, number>;
    errorsByEndpoint: Record<string, number>;
}

export interface DashboardDataResponse {
    health: {
        status: string;
        uptime: number;
        services: Array<{
            name: string;
            status: string;
            responseTime?: number;
        }>;
    };
    performance: {
        requests: {
            total: number;
            averageResponseTime: number;
            errorRate: number;
        };
        memory: {
            usage: number;
            heapUsed: number;
        };
        errors: {
            rate: number;
            recentCount: number;
        };
    };
    errors: {
        total: number;
        rate: number;
        topErrors: Array<{
            fingerprint: string;
            message: string;
            count: number;
        }>;
    };
    alerts: {
        active: number;
        critical: number;
        high: number;
    };
    metrics: {
        counters: number;
        gauges: number;
        histograms: number;
    };
}
