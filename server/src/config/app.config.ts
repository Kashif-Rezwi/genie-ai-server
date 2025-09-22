export const appConfig = () => ({
    port: parseInt(process.env.PORT || '4000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0',
    cors: {
        origins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
    },
    security: {
        enableHeaders: process.env.SECURITY_HEADERS === 'true',
        enableRateLimiting: process.env.ENABLE_RATE_LIMITING === 'true',
    },
    monitoring: {
        performanceEnabled: process.env.PERFORMANCE_MONITORING_ENABLED === 'true',
        logLevel: process.env.LOG_LEVEL || 'info',
    },
});
