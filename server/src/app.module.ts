import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { AIModule } from './modules/ai/ai.module';
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
        HealthModule,
        AuthModule,
        UsersModule,
        AIModule,
    ],
})
export class AppModule { }