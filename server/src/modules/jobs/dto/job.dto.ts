import { IsString, IsOptional, IsEnum, IsBoolean, IsNumber, IsArray, IsDateString } from 'class-validator';

export class TriggerAnalyticsDto {
    @IsEnum(['daily', 'weekly', 'monthly', 'custom'])
    type: 'daily' | 'weekly' | 'monthly' | 'custom';

    @IsOptional()
    @IsArray()
    metrics?: string[];

    @IsOptional()
    @IsDateString()
    startDate?: string;

    @IsOptional()
    @IsDateString()
    endDate?: string;
}

export class TriggerMaintenanceDto {
    @IsEnum(['cleanup', 'backup', 'reconcile', 'optimize', 'security_scan'])
    task: 'cleanup' | 'backup' | 'reconcile' | 'optimize' | 'security_scan';

    @IsOptional()
    @IsString()
    targetTable?: string;

    @IsOptional()
    @IsBoolean()
    dryRun?: boolean;

    @IsOptional()
    @IsNumber()
    batchSize?: number;
}

export class RetryJobsDto {
    @IsOptional()
    @IsNumber()
    limit?: number = 10;
}

export interface JobStatusResponse {
    id: string;
    name: string;
    status: string;
    progress: number;
    data: any;
    result?: any;
    error?: string;
    createdAt: Date;
    processedAt?: Date;
    finishedAt?: Date;
}

export interface QueueStatsResponse {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: number;
}