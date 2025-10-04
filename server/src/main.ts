import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { appConfig } from './config';
import helmet from 'helmet';

async function bootstrap() {
  // Create NestJS app instance (like express())
  const app = await NestFactory.create(AppModule, {
    rawBody: true, // Enable raw body for webhooks
  });

  // Load app configuration
  const config = appConfig();

  // Trust proxy for HTTPS detection (when behind load balancer)
  if (config.security.trustProxy) {
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
  }

  // Security headers with helmet
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false, // Disable for API compatibility
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
    })
  );

  // Enable CORS for cross-origin requests
  app.enableCors(config.cors);

  // Add 'api' prefix to all routes (e.g., /users becomes /api/users)
  app.setGlobalPrefix('api');

  // Start server on configured port
  const port = config.port;
  await app.listen(port);

  // Log startup info
  // Server started successfully
  // Health checks available at /api/health

  // Handle graceful shutdown
  process.on('SIGTERM', async () => {
    // SIGTERM signal received: closing HTTP server
    await app.close();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    // SIGINT signal received: closing HTTP server
    await app.close();
    process.exit(0);
  });
}

// Start the application
bootstrap().catch(error => {
  console.error('Failed to start application:', error);
  process.exit(1);
});
