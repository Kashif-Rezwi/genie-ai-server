export const appConfig = () => ({
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  version: process.env.npm_package_version || '1.0.0',
  cors: {
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-api-key',
      'x-requested-with',
      'accept',
      'origin',
    ],
    exposedHeaders: ['x-total-count', 'x-page-count'],
    maxAge: 86400, // 24 hours
  },
  security: {
    enableHeaders: process.env.SECURITY_HEADERS === 'true',
    enableRateLimiting: process.env.ENABLE_RATE_LIMITING === 'true',
    trustProxy: process.env.TRUST_PROXY === 'true',
  },
});
