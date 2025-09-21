export interface BaseJobData {
    jobId: string;
    userId?: string;
    priority?: number | string;
    metadata?: Record<string, any>;
    createdAt: Date;
}

export interface AIJobData extends BaseJobData {
    chatId: string;
    messageId: string;
    modelId: string;
    messages: Array<{
        role: 'user' | 'assistant' | 'system';
        content: string;
    }>;
    options: {
        maxTokens: number;
        temperature: number;
        stream?: boolean;
    };
    retryCount?: number;
}

export interface PaymentJobData extends BaseJobData {
    paymentId: string;
    action: 'process' | 'verify' | 'retry' | 'refund' | 'reconcile';
    razorpayPaymentId?: string;
    razorpayOrderId?: string;
    amount?: number;
    reason?: string;
}

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

export interface AnalyticsJobData extends BaseJobData {
    type: 'daily' | 'weekly' | 'monthly' | 'custom';
    metrics: string[];
    dateRange?: {
        start: Date;
        end: Date;
    };
    aggregationType: 'sum' | 'average' | 'count' | 'max' | 'min';
    outputFormat: 'json' | 'csv' | 'pdf';
}

export interface MaintenanceJobData extends BaseJobData {
    task: 'cleanup' | 'backup' | 'reconcile' | 'optimize' | 'security_scan';
    targetTable?: string;
    conditions?: Record<string, any>;
    batchSize?: number;
    dryRun?: boolean;
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