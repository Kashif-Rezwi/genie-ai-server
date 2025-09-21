import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { SecurityMiddleware } from './modules/security/middleware/security.middleware';
import { ValidationMiddleware } from './modules/security/middleware/validation.middleware';
import { RequestMonitoringMiddleware } from './modules/monitoring/middleware/request-monitoring.middleware';
import { ErrorMonitoringMiddleware } from './modules/monitoring/middleware/error-monitoring.middleware';
import helmet from 'helmet';

async function bootstrap() {
    const app = await NestFactory.create(AppModule, {
        rawBody: true, // Enable raw body for webhooks
        cors: {
            origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
        }
    });

    // Security headers
    if (process.env.SECURITY_HEADERS === 'true') {
        app.use(helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: ["'self'", "'unsafe-inline'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    imgSrc: ["'self'", "data:", "https:"],
                },
            },
            hsts: process.env.NODE_ENV === 'production' ? {
                maxAge: 31536000,
                includeSubDomains: true,
            } : false,
        }));
    }

    app.setGlobalPrefix('api');
    // app.enableCors();

    // Global validation
    app.useGlobalPipes(new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        disableErrorMessages: process.env.NODE_ENV === 'production',
        validationError: {
            target: false,
            value: false,
        },
    }));

    // Global exception filter
    app.useGlobalFilters(new AllExceptionsFilter());

    // Get services for middleware
    const requestMonitoring = app.get(RequestMonitoringMiddleware);
    const errorMonitoring = app.get(ErrorMonitoringMiddleware);
    const securityMiddleware = app.get(SecurityMiddleware);
    const validationMiddleware = app.get(ValidationMiddleware);

    // Apply middleware in order
    app.use(requestMonitoring.use.bind(requestMonitoring));
    app.use(errorMonitoring.use.bind(errorMonitoring));
    app.use(securityMiddleware.use.bind(securityMiddleware));
    app.use(validationMiddleware.use.bind(validationMiddleware));

    const port = process.env.PORT || 4000;
    await app.listen(port);

    console.log(`🚀 Genie API running on port ${port}`);
    console.log(`🔒 Security features: ${process.env.SECURITY_HEADERS === 'true' ? 'Enabled' : 'Disabled'}`);
    console.log(`⚡ Rate limiting: ${process.env.ENABLE_RATE_LIMITING === 'true' ? 'Enabled' : 'Disabled'}`);
    console.log(`📊 Monitoring: ${process.env.PERFORMANCE_MONITORING_ENABLED === 'true' ? 'Enabled' : 'Disabled'}`);
    console.log(`🏥 Health checks: Available at /api/monitoring/health`);
    console.log(`📈 Metrics: Available at /api/monitoring/metrics`);
}
bootstrap();