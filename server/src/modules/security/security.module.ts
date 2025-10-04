import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RedisService } from '../redis/redis.service';
import { RateLimitService } from './services/rate-limit.service';
import { RateLimitMonitoringService } from './services/rate-limit-monitoring.service';
import { InputSanitizationService } from './services/input-sanitization.service';
import { CSRFProtectionService } from './services/csrf-protection.service';
import { RequestSizeService } from './services/request-size.service';
import { SecurityService } from './services/security.service';
import { PerUserRateLimitService } from './services/per-user-rate-limit.service';
import { BruteForceProtectionService } from './services/brute-force-protection.service';
import { AuditLoggingService } from './services/audit-logging.service';
import { ContentSecurityPolicyService } from './services/content-security-policy.service';
import { SecurityController } from './security.controller';
import { LoggingService } from '../monitoring/services/logging.service';
import { User } from '../../entities';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [SecurityController],
  providers: [
    RedisService,
    RateLimitService,
    RateLimitMonitoringService,
    InputSanitizationService,
    CSRFProtectionService,
    RequestSizeService,
    SecurityService,
    PerUserRateLimitService,
    BruteForceProtectionService,
    AuditLoggingService,
    ContentSecurityPolicyService,
    LoggingService,
  ],
  exports: [
    RedisService,
    RateLimitService,
    RateLimitMonitoringService,
    InputSanitizationService,
    CSRFProtectionService,
    RequestSizeService,
    SecurityService,
    PerUserRateLimitService,
    BruteForceProtectionService,
    AuditLoggingService,
    ContentSecurityPolicyService,
  ],
})
export class SecurityModule {}
