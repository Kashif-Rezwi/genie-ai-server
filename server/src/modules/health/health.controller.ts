import { Controller, Get, UseGuards } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Chat, Message } from '../../entities';

@Controller('health')
export class HealthController {
    constructor(@InjectDataSource() private dataSource: DataSource) { }

    @Get()
    async healthCheck() {
        const isDbConnected = this.dataSource.isInitialized;

        return {
            service: 'genie-api',
            apiStatus: 'running',
            databaseStatus: isDbConnected ? 'connected' : 'disconnected',
            timestamp: new Date().toISOString(),
            version: '1.0.0',
        };
    }

    @Get('detailed')
    @UseGuards(JwtAuthGuard)
    async detailedHealthCheck() {
        const isDbConnected = this.dataSource.isInitialized;

        // Test database operations
        let dbOperational = false;
        let totalChats = 0;
        let totalMessages = 0;

        try {
            const chatRepo = this.dataSource.getRepository(Chat);
            const messageRepo = this.dataSource.getRepository(Message);

            totalChats = await chatRepo.count();
            totalMessages = await messageRepo.count();
            dbOperational = true;
        } catch (error) {
            console.error('Database operation failed:', error);
        }

        return {
            apiStatus: 'running',
            databaseStatus: isDbConnected ? 'connected' : 'disconnected',
            operationsStatus: dbOperational ? 'operational' : 'failed',
            timestamp: new Date().toISOString(),
            services: {
                database: isDbConnected ? 'connected' : 'disconnected',
                operations: dbOperational ? 'operational' : 'failed',
            },
            metrics: {
                totalChats,
                totalMessages,
                uptime: process.uptime(),
            },
        };
    }
}