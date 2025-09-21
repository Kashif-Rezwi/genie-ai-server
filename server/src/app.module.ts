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
import { RateLimitGuard } from './modules/security/guards/rate-limit.guard';
import { SecurityMiddleware } from './modules/security/middleware/security.middleware';
import { ValidationMiddleware } from './modules/security/middleware/validation.middleware';
import { databaseConfig } from './config/database.config';

@Module({
    imports: [
        ConfigModule.forRoot({ 
            isGlobal: true,
            envFilePath: '.env',
        }),
        TypeOrmModule.forRootAsync({
            useFactory: databaseConfig,
        }),
        SecurityModule,
        HealthModule,
        AuthModule,
        UsersModule,
        CreditsModule,
        AIModule,
        ChatModule,
        PaymentsModule,
    ],
    providers: [
        // Apply rate limiting globally if enabled
        ...(process.env.ENABLE_RATE_LIMITING === 'true' ? [{
            provide: APP_GUARD,
            useClass: RateLimitGuard,
        }] : []),
    ],
})

export class AppModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        consumer
            .apply(SecurityMiddleware)
            .forRoutes('*') // Apply to all routes
            .apply(ValidationMiddleware)
            .forRoutes('*');
    }
}