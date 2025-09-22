import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { AIModule } from './modules/ai/ai.module';
import { CreditsModule } from './modules/credits/credits.module';
import { ChatModule } from './modules/chat/chat.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { SecurityModule } from './modules/security/security.module';
import { MonitoringModule } from './modules/monitoring/monitoring.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { RedisModule } from './modules/redis/redis.module';

// Guards and middleware
import { RateLimitGuard } from './modules/security/guards/rate-limit.guard';
import { SecurityMiddleware } from './modules/security/middleware/security.middleware';
import { ValidationMiddleware } from './modules/security/middleware/validation.middleware';
import { RequestMonitoringMiddleware } from './modules/monitoring/middleware/request-monitoring.middleware';
import { ErrorMonitoringMiddleware } from './modules/monitoring/middleware/error-monitoring.middleware';

// Configuration
import { databaseConfig, appConfig } from './config';

const config = appConfig();

// Root module - like your main Express app configuration
@Module({
    imports: [
        // Environment variables configuration (like dotenv)
        ConfigModule.forRoot({ 
            isGlobal: true, // Available everywhere without importing
            envFilePath: '.env', // Load from .env file
        }),
        
        // Database connection (like mongoose.connect() or sequelize)
        TypeOrmModule.forRootAsync({
            useFactory: databaseConfig, // Database config from separate file
        }),
        
        // Feature modules (like app.use('/api/users', userRouter))
        MonitoringModule,  // Health checks, metrics, logging
        SecurityModule,    // Security features, rate limiting
        HealthModule,      // /health endpoint
        AuthModule,        // /auth routes (login, register, JWT)
        UsersModule,       // /users routes (user management)
        CreditsModule,     // /credits routes (credit system)
        AIModule,          // /ai routes (AI API calls)
        ChatModule,        // /chat routes (chat functionality)
        PaymentsModule,    // /payments routes (Razorpay integration)
        JobsModule,        // Background jobs (like Bull queue)
        RedisModule,       // Redis cache/session store
    ],
    
    // Global providers (like global middleware)
    providers: [
        // Conditionally apply rate limiting globally
        ...(config.security.enableRateLimiting ? [{
            provide: APP_GUARD,        // Global guard (like app.use(authMiddleware))
            useClass: RateLimitGuard,  // Rate limiting implementation
        }] : []),
        // Middleware providers
        RequestMonitoringMiddleware,
        ErrorMonitoringMiddleware,
    ],
})

// Implement NestModule to configure middleware
export class AppModule implements NestModule {
    constructor(
        private readonly requestMonitoring: RequestMonitoringMiddleware,
        private readonly errorMonitoring: ErrorMonitoringMiddleware,
    ) {}

    // Configure middleware (like app.use() in Express)
    configure(consumer: MiddlewareConsumer) {
        consumer
            .apply(SecurityMiddleware)    // Security headers, CORS, etc.
            .forRoutes('*')               // Apply to all routes
            .apply(ValidationMiddleware)  // Input validation
            .forRoutes('*')             // Apply to all routes
            // Monitoring middleware temporarily disabled due to routing issues
            // .apply(this.requestMonitoring.use.bind(this.requestMonitoring))  // Request monitoring
            // .forRoutes('*')               // Apply to all routes
            // .apply(this.errorMonitoring.use.bind(this.errorMonitoring))      // Error monitoring
            // .forRoutes('*');              // Apply to all routes
    }
}