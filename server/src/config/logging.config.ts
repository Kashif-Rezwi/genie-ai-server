export const loggingConfig = () => ({
    level: process.env.LOG_LEVEL || 'info',
    console: {
        enabled: process.env.LOG_CONSOLE_ENABLED === 'true',
    },
    file: {
        enabled: process.env.LOG_FILE_ENABLED === 'true',
        path: process.env.LOG_FILE_PATH || './logs',
        datePattern: process.env.LOG_DATE_PATTERN || 'YYYY-MM-DD',
        maxSize: process.env.LOG_MAX_SIZE || '20m',
        maxFiles: process.env.LOG_MAX_FILES || '14d',
    },
    slowQueryThreshold: parseInt(process.env.SLOW_QUERY_THRESHOLD || '1000', 10),
});
