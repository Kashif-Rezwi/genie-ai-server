import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RedisService } from '../redis/redis.service';
import { RateLimitService } from './services/rate-limit.service';
import { SecurityService } from './services/security.service';
import { SecurityController } from './security.controller';
import { LoggerService } from '../../common/services/logger.service';
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
        SecurityService,
        LoggerService,
    ],
    exports: [RedisService, RateLimitService, SecurityService],
})
export class SecurityModule {}