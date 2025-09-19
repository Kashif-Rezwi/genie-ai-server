import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './modules/health/health.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { databaseConfig } from './config/database.config';
import { User, Chat, Message, CreditTransaction } from './entities';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        TypeOrmModule.forRootAsync({
            useFactory: databaseConfig,
        }),
        TypeOrmModule.forFeature([User, Chat, Message, CreditTransaction]),
        HealthModule,
    ],
})
export class AppModule { }