import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';

// Feature Modules
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';

// Configuration
import { appConfig, databaseConfig } from './config';

// Common Filters
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

@Module({
    imports: [
        // Environment variables configuration
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: ['.env.local', '.env'],
            cache: true,
            expandVariables: true,
        }),

        // Database configuration (like mongoose.connect)
        TypeOrmModule.forRootAsync({
            useFactory: databaseConfig,
        }),

        // Feature Modules (dependency order)
        HealthModule,
        AuthModule,
    ],

    providers: [
        {
            // Global error handler (catches all unhandled errors)
            provide: APP_FILTER,
            useClass: AllExceptionsFilter,
        },
        {
            // Global validation pipe (validates incoming data)
            provide: APP_PIPE,
            useFactory: () =>
                new ValidationPipe({
                    whitelist: true,
                    forbidNonWhitelisted: true,
                    transform: true,
                    disableErrorMessages: appConfig().nodeEnv === 'production',
                    validationError: {
                        target: false,
                        value: false,
                    },
                }),
        },
    ],
})
export class AppModule {}
