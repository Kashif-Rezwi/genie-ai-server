import { Controller, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

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
}