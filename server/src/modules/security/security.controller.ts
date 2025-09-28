import {
    Controller,
    Get,
    Post,
    Delete,
    Body,
    Param,
    UseGuards,
    ValidationPipe,
} from '@nestjs/common';
import { ApiKeyService, CreateApiKeyDto } from './services/api-key.service';
import { RateLimitService } from './services/rate-limit.service';
import { SecurityService } from './services/security.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard, Roles, UserRole } from './guards/roles.guard';
import { RateLimit, RateLimitGuard } from './guards/rate-limit.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('security')
@UseGuards(JwtAuthGuard, RateLimitGuard)
export class SecurityController {
    constructor(
        private readonly apiKeyService: ApiKeyService,
        private readonly rateLimitService: RateLimitService,
        private readonly securityService: SecurityService,
    ) {}

    @Post('api-keys')
    @RateLimit('api')
    async createApiKey(@CurrentUser() user: any, @Body(ValidationPipe) createDto: CreateApiKeyDto) {
        return this.apiKeyService.createApiKey(user.id, createDto);
    }

    @Get('api-keys')
    async getUserApiKeys(@CurrentUser() user: any) {
        return this.apiKeyService.getUserApiKeys(user.id);
    }

    @Delete('api-keys/:keyId')
    async revokeApiKey(@CurrentUser() user: any, @Param('keyId') keyId: string) {
        await this.apiKeyService.revokeApiKey(keyId, user.id);
        return { message: 'API key revoked successfully' };
    }

    @Get('rate-limit-status')
    @RateLimit('api')
    async getRateLimitStatus(@CurrentUser() user: any) {
        const [apiStatus, aiStatus, chatStatus] = await Promise.all([
            this.rateLimitService.getRateLimitStatus('basic_user', user.id),
            this.rateLimitService.getRateLimitStatus('ai_paid', user.id),
            this.rateLimitService.getRateLimitStatus('chat_creation', user.id),
        ]);

        return {
            api: apiStatus,
            ai: aiStatus,
            chat: chatStatus,
        };
    }

    @Post('validate-password')
    @RateLimit('api')
    async validatePassword(@Body('password') password: string) {
        const validation = this.securityService.validatePassword(password);
        const strength = this.securityService.checkPasswordStrength(password);

        return {
            ...validation,
            strength,
        };
    }

    // Admin endpoints
    @Get('admin/api-key-stats')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    async getApiKeyStats() {
        return this.apiKeyService.getApiKeyStats();
    }

    @Post('admin/reset-rate-limit/:userId')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    async resetUserRateLimit(
        @Param('userId') userId: string,
        @Body('operation') operation: string,
    ) {
        const userTier = await this.rateLimitService.getUserTierFromCredits(userId);
        await this.rateLimitService.resetRateLimit(`${userTier}_user`, userId);

        return { message: 'Rate limit reset successfully' };
    }
}
