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

    // Add 'api' prefix to all routes (e.g., /users becomes /api/users)
    app.setGlobalPrefix('api');

    // Global validation pipe (validates incoming data)
    app.useGlobalPipes(new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        disableErrorMessages: config.nodeEnv === 'production',
        validationError: {
            target: false,
            value: false,
        },
    }));

    // Global error handler (catches all unhandled errors)
    app.useGlobalFilters(new AllExceptionsFilter());

    // Start server on configured port
    const port = config.port;
    await app.listen(port);

    // Log startup info
    console.log(`🚀 Genie API running on port ${port}`);
    console.log(`🏥 Health checks: Available at /api/health`);

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