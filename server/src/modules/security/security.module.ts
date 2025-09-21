import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { RedisService } from '../../config/redis.config';
import { RateLimitService } from './services/rate-limit.service';
import { SecurityService } from './services/security.service';
import { ApiKeyService } from './services/api-key.service';
import { SecurityController } from './security.controller';
import { User, ApiKey } from '../../entities';

@Global()
@Module({
    imports: [
        TypeOrmModule.forFeature([User, ApiKey]),
        ThrottlerModule.forRoot({
            throttlers: [{
                ttl: parseInt(process.env.RATE_LIMIT_TTL) || 60,
                limit: parseInt(process.env.RATE_LIMIT_MAX) || 100,
            }]
        }),
    ],
    controllers: [
        SecurityController
    ],
    providers: [
        RedisService,
        RateLimitService,
        SecurityService,
        ApiKeyService,
    ],
    exports: [
        RedisService,
        RateLimitService,
        SecurityService,
        ApiKeyService,
    ],
})
export class SecurityModule { }