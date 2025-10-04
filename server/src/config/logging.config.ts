export const loggingConfig = () => ({
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'warn' : 'info'),
    console: {
        enabled:
            process.env.NODE_ENV !== 'production' || process.env.LOG_CONSOLE_ENABLED === 'true',
    },
    file: {
        enabled: process.env.LOG_FILE_ENABLED !== 'false',
        path: process.env.LOG_FILE_PATH || './logs',
        datePattern: process.env.LOG_DATE_PATTERN || 'YYYY-MM-DD',
        maxSize: process.env.LOG_MAX_SIZE || '10m',
        maxFiles: process.env.LOG_MAX_FILES || '7d',
    },
    slowQueryThreshold: parseInt(process.env.SLOW_QUERY_THRESHOLD || '500', 10),
    // Production optimizations
    production: {
        enableRequestLogging: process.env.ENABLE_REQUEST_LOGGING !== 'false',
        enableErrorAlerts: process.env.ENABLE_ERROR_ALERTS !== 'false',
        logRetentionDays: parseInt(process.env.LOG_RETENTION_DAYS || '7', 10),
    },
});
