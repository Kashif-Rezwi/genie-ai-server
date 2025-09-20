import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { AIModule } from './modules/ai/ai.module';
import { CreditsModule } from './modules/credits/credits.module';
import { ChatModule } from './modules/chat/chat.module';
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
        CreditsModule,
        AIModule,
        ChatModule,
    ],
})
export class AppModule { }