export interface BaseJobData {
    jobId: string;
    userId?: string;
    priority?: number | string;
    metadata?: Record<string, any>;
    createdAt: Date;
}

// Current interface for 0-1000 users
export interface EmailJobData extends BaseJobData {
    to: string | string[];
    subject: string;
    template: string;
    templateData: Record<string, any>;
    attachments?: Array<{
        filename: string;
        content: Buffer | string;
        contentType: string;
    }>;
    priority: string;
}

export enum JobStatus {
    PENDING = 'pending',
    ACTIVE = 'active',
    COMPLETED = 'completed',
    FAILED = 'failed',
    DELAYED = 'delayed',
    PAUSED = 'paused',
}

export enum JobPriority {
    LOW = 1,
    NORMAL = 5,
    HIGH = 10,
    CRITICAL = 15,
}

// Production-ready job options
export interface ProductionJobOptions {
    attempts: number;
    backoff: {
        type: 'exponential' | 'fixed';
        delay: number;
    };
    removeOnComplete: number;
    removeOnFail: number;
    timeout?: number; // Job timeout in milliseconds
    delay?: number; // Delay before processing
    priority?: number;
}

// Error handling interfaces
export interface JobError {
    message: string;
    stack?: string;
    timestamp: Date;
    attemptNumber: number;
    jobId: string;
}

export interface DeadLetterJob {
    jobId: string;
    originalData: any;
    error: JobError;
    failedAt: Date;
    retryCount: number;
}

// Future interfaces for scaling - add when needed
// AIJobData, PaymentJobData, AnalyticsJobData, MaintenanceJobData