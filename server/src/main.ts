import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { appConfig } from './config';
import { validateEnvironment } from './config/validation.config';
import * as compression from 'compression';
import helmet from 'helmet';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
    // Validate environment variables
    try {
        validateEnvironment(process.env);
        console.log('✅ Environment variables validated successfully');
    } catch (error) {
        console.error('❌ Environment validation failed:', error.message);
        process.exit(1);
    }

    // Create NestJS app instance (like express())
    const app = await NestFactory.create(AppModule, {
        rawBody: true, // Enable raw body for webhooks
    });

    // Load app configuration
    const config = appConfig();

    // Enable Helmet for security headers
    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                scriptSrc: ["'self'"],
                imgSrc: ["'self'", "data:", "https:"],
                connectSrc: ["'self'", "https:"],
                fontSrc: ["'self'", "data:"],
                objectSrc: ["'none'"],
                mediaSrc: ["'self'"],
                frameSrc: ["'none'"],
            },
        },
        crossOriginEmbedderPolicy: false,
    }));

    // Enable compression for better performance
    app.use(compression({
        level: 6, // Compression level (1-9, 6 is good balance)
        threshold: 1024, // Only compress responses > 1KB
        filter: (req, res) => {
            if (req.headers['x-no-compression']) {
                return false;
            }
            return compression.filter(req, res);
        },
    }));

    // Enable CORS for cross-origin requests
    app.enableCors(config.cors);

    // HTTPS redirect middleware (production only)
    if (config.nodeEnv === 'production') {
        app.use((req: any, res: any, next: any) => {
            if (req.header('x-forwarded-proto') !== 'https') {
                res.redirect(`https://${req.header('host')}${req.url}`);
            } else {
                next();
            }
        });
    }

    // Add 'api' prefix to all routes (e.g., /users becomes /api/users)
    app.setGlobalPrefix('api');

    // Swagger API Documentation
    const swaggerConfig = new DocumentBuilder()
        .setTitle('Genie AI Server API')
        .setDescription('AI-powered chat and credit management system')
        .setVersion('1.0')
        .addBearerAuth()
        .addTag('Authentication', 'User authentication and management')
        .addTag('AI', 'AI model interactions and responses')
        .addTag('Chat', 'Chat sessions and message management')
        .addTag('Credits', 'Credit balance and transaction management')
        .addTag('Payments', 'Payment processing and billing')
        .addTag('Security', 'Security features and rate limiting')
        .addTag('Monitoring', 'Health checks and system monitoring')
        .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
        swaggerOptions: {
            persistAuthorization: true,
        },
    });

    // Start server on configured port
    const port = config.port;
    await app.listen(port);

    // Log startup info
    console.log(`🚀 Genie API running on port ${port}`);
    console.log(`🏥 Health checks: Available at /api/health`);
    console.log(`📚 API Documentation: Available at /api/docs`);

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
bootstrap().catch(error => {
    console.error('Failed to start application:', error);
    process.exit(1);
});
