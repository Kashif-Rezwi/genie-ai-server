import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { RedisService } from '../redis/redis.service';
import { RateLimitService } from './services/rate-limit.service';
import { SecurityService } from './services/security.service';
import { ApiKeyService } from './services/api-key.service';
import { SecurityController } from './security.controller';
import { SecurityMiddleware } from './middleware/security.middleware';
import { ValidationMiddleware } from './middleware/validation.middleware';
import { User, ApiKey } from '../../entities';
import { securityConfig } from '../../config';

const config = securityConfig();

@Global()
@Module({
    imports: [
        TypeOrmModule.forFeature([User, ApiKey]),
        ThrottlerModule.forRoot({
            throttlers: [{
                ttl: config.rateLimit.ttl,
                limit: config.rateLimit.max,
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
        SecurityMiddleware,
        ValidationMiddleware,
    ],
    exports: [
        RedisService,
        RateLimitService,
        SecurityService,
        ApiKeyService,
    ],
})
export class SecurityModule { }