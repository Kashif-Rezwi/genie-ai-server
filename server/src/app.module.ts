import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

// Feature Modules
import { HealthModule } from './modules/health/health.module';

// Configuration
import { databaseConfig } from './config';

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
            inject: [],
        }),
        
        // Feature Modules (dependency order)
        HealthModule,
    ],
    
    providers: [],
})
export class AppModule {}