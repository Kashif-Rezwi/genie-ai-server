import { Module, ValidationPipe, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';

// Feature Modules
import { MonitoringModule } from './modules/monitoring/monitoring.module';
import { AuthModule } from './modules/auth/auth.module';
import { AIModule } from './modules/ai/ai.module';
import { SecurityModule } from './modules/security/security.module';
import { SecurityMiddleware } from './modules/security/middleware/security.middleware';
import { ValidationMiddleware } from './modules/security/middleware/validation.middleware';
import { RequestMonitoringMiddleware } from './modules/monitoring/middleware/request-monitoring.middleware';

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
    SecurityModule, // Security must be loaded first
    MonitoringModule, // Monitoring must be loaded early
    AuthModule,
    AIModule,
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
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RequestMonitoringMiddleware, SecurityMiddleware, ValidationMiddleware)
      .forRoutes('*');
  }
}
