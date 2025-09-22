import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { appConfig } from './config';
import helmet from 'helmet';

async function bootstrap() {
    // Create NestJS app instance (like express())
    const app = await NestFactory.create(AppModule, {
        rawBody: true, // Enable raw body for webhooks
    });

    // Load app configuration
    const config = appConfig();

    // Enable CORS for cross-origin requests
    app.enableCors(config.cors);

    // Add security headers (helmet)
    if (config.security.enableHeaders) {
        app.use(helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: ["'self'", "'unsafe-inline'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    imgSrc: ["'self'", "data:", "https:"],
                },
            },
            hsts: config.nodeEnv === 'production' ? {
                maxAge: 31536000,
                includeSubDomains: true,
            } : false,
        }));
    }

    // Add 'api' prefix to all routes (e.g., /users becomes /api/users)
    app.setGlobalPrefix('api');

    // Global validation pipe (validates incoming data)
    app.useGlobalPipes(new ValidationPipe({
        whitelist: true, // Remove unknown properties
        forbidNonWhitelisted: true, // Throw error for unknown properties
        transform: true, // Auto-convert types (string "123" → number 123)
        disableErrorMessages: config.nodeEnv === 'production', // Hide errors in production
        validationError: {
            target: false, // Hide the entire request object from error responses (prevents data leaks)
            value: false,  // Hide the invalid field value from error responses (protects sensitive data)
        },
    }));

    // Global error handler (catches all unhandled errors)
    app.useGlobalFilters(new AllExceptionsFilter());

    // Start server on configured port
    const port = config.port;
    await app.listen(port);

    // Log startup info
    console.log(`🚀 Genie API running on port ${port}`);
    console.log(`🔒 Security features: ${config.security.enableHeaders ? 'Enabled' : 'Disabled'}`);
    console.log(`⚡ Rate limiting: ${config.security.enableRateLimiting ? 'Enabled' : 'Disabled'}`);
    console.log(`📊 Monitoring: ${config.monitoring.performanceEnabled ? 'Enabled' : 'Disabled'}`);
    console.log(`🏥 Health checks: Available at /api/health`);
    console.log(`📈 Metrics: Available at /api/monitoring/metrics`);

    // Handle graceful shutdown
    process.on('SIGTERM', async () => {
        console.log('SIGTERM signal received: closing HTTP server');
        await app.close();
        process.exit(0);
    });

    process.on('SIGINT', async () => {
        console.log('SIGINT signal received: closing HTTP server');
        await app.close();
        process.exit(0);
    });
}

// Start the application
bootstrap().catch((error) => {
    console.error('Failed to start application:', error);
    process.exit(1);
});