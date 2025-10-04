import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RedisService } from '../redis/redis.service';
import { RateLimitService } from './services/rate-limit.service';
import { SecurityService } from './services/security.service';
import { SecurityController } from './security.controller';
import { LoggingService } from '../monitoring/services/logging.service';
import { InputSanitizationMiddleware } from './middleware/input-sanitization.middleware';
import { CsrfMiddleware } from './middleware/csrf.middleware';
import { AuditService } from './services/audit.service';
import { User } from '../../entities';

@Global()
@Module({
    imports: [TypeOrmModule.forFeature([User])],
    controllers: [SecurityController],
    providers: [
        RedisService,
        RateLimitService,
        SecurityService,
        LoggingService,
        InputSanitizationMiddleware,
        CsrfMiddleware,
        AuditService,
    ],
    exports: [
        RedisService,
        RateLimitService,
        SecurityService,
        InputSanitizationMiddleware,
        CsrfMiddleware,
        AuditService,
    ],
})
export class SecurityModule {}
