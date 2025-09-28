export const monitoringConfig = () => ({
    performance: {
        requestTimeoutThreshold: parseInt(process.env.REQUEST_TIMEOUT_THRESHOLD || '30000', 10),
        memoryUsageThreshold: parseInt(process.env.MEMORY_USAGE_THRESHOLD || '80', 10),
    },
    health: {
        checkInterval: process.env.HEALTH_CHECK_INTERVAL
            ? parseInt(process.env.HEALTH_CHECK_INTERVAL, 10)
            : undefined,
    },
    notifications: {
        errorEmail: process.env.ERROR_NOTIFICATION_EMAIL?.split(',') || [],
        slackWebhook: process.env.SLACK_WEBHOOK_URL,
        discordWebhook: process.env.DISCORD_WEBHOOK_URL,
        criticalErrorWebhook: process.env.CRITICAL_ERROR_WEBHOOK,
    },
    jobs: {
        enabled: process.env.ENABLE_CRON_JOBS === 'true',
    },
});
