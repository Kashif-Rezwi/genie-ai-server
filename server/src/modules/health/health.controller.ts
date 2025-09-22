import { Controller, Get, UseGuards } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Chat, Message } from '../../entities';

@Controller('health')
export class HealthController {
    constructor(@InjectDataSource() private dataSource: DataSource) { }

    @Get()
    check() {
        return {
            status: 'ok',
            timestamp: new Date().toISOString(),
            service: 'genie-api',
            version: '1.0.0'
        };
    }

    @Get('ready')
    async ready() {
        const isDbConnected = this.dataSource.isInitialized;
        return { 
            status: isDbConnected ? 'ready' : 'not ready',
            database: isDbConnected ? 'connected' : 'disconnected'
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
            status: isDbConnected && dbOperational ? 'healthy' : 'unhealthy',
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