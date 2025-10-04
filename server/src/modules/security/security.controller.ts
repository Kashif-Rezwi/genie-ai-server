import {
    Controller,
    Post,
    Body,
    Get,
    UseGuards,
} from '@nestjs/common';
import { SecurityService } from './services/security.service';
import { RateLimitMonitoringService } from './services/rate-limit-monitoring.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard, Roles, UserRole } from './guards/roles.guard';

@Controller('security')
@UseGuards(JwtAuthGuard)
export class SecurityController {
    constructor(
        private readonly securityService: SecurityService,
        private readonly rateLimitMonitoringService: RateLimitMonitoringService,
    ) {}

    @Post('validate-password')
    async validatePassword(@Body('password') password: string) {
        const validation = this.securityService.validatePassword(password);
        const strength = this.securityService.checkPasswordStrength(password);
        return { ...validation, strength };
    }

    // Rate limiting monitoring endpoints (admin only)
    @Get('rate-limits/stats')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    async getRateLimitStats() {
        return this.rateLimitMonitoringService.getRateLimitStats();
    }

    @Get('rate-limits/alerts')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    async getRateLimitAlerts() {
        return this.rateLimitMonitoringService.checkForAlerts();
    }

    @Post('rate-limits/reset')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    async resetRateLimitStats() {
        await this.rateLimitMonitoringService.resetStats();
        return { message: 'Rate limit stats reset successfully' };
    }
}