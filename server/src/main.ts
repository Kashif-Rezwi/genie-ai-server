import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
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

    // Enable global validation
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

    const port = process.env.PORT || 4000;
    await app.listen(port);
    console.log(`🚀 Genie API running on port ${port}`);
    console.log(`🔒 Security features: ${process.env.SECURITY_HEADERS === 'true' ? 'Enabled' : 'Disabled'}`);
    console.log(`⚡ Rate limiting: ${process.env.ENABLE_RATE_LIMITING === 'true' ? 'Enabled' : 'Disabled'}`);
}
bootstrap();