export const monitoringConfig = () => ({
  health: {
    checkInterval: process.env.HEALTH_CHECK_INTERVAL
      ? parseInt(process.env.HEALTH_CHECK_INTERVAL, 10)
      : undefined,
  },
  notifications: {
    errorEmail: process.env.ERROR_NOTIFICATION_EMAIL?.split(',') || [],
  },
});
