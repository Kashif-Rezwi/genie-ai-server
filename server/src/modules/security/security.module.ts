import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RedisService } from '../redis/redis.service';
import { RateLimitService } from './services/rate-limit.service';
import { RateLimitMonitoringService } from './services/rate-limit-monitoring.service';
import { SecurityService } from './services/security.service';
import { SecurityController } from './security.controller';
import { LoggingService } from '../monitoring/services/logging.service';
import { User } from '../../entities';

@Global()
@Module({
    imports: [
        TypeOrmModule.forFeature([User]),
    ],
    controllers: [SecurityController],
    providers: [
        RedisService,
        RateLimitService,
        RateLimitMonitoringService,
        SecurityService,
        LoggingService,
    ],
    exports: [RedisService, RateLimitService, RateLimitMonitoringService, SecurityService],
})
export class SecurityModule {}