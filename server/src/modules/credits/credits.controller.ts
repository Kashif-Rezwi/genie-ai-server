import { Controller, Get, UseGuards } from '@nestjs/common';
import { CreditsService } from './services/credits.service';
import { CreditsAnalyticsService } from './services/credits-analytics.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RateLimitGuard } from '../security/guards/rate-limit.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('credits')
@UseGuards(JwtAuthGuard, RateLimitGuard)
export class CreditsController {
    constructor(
        private readonly creditsService: CreditsService,
        private readonly analyticsService: CreditsAnalyticsService,
    ) {}

    @Get('balance')
    async getBalance(@CurrentUser() user: { id: string }) {
        const balance = await this.creditsService.getBalance(user.id);
        return { balance };
    }

    @Get('transactions')
    async getTransactions(@CurrentUser() user: { id: string }) {
        const transactions = await this.creditsService.getRecentTransactions(user.id);
        return { transactions };
    }

    @Get('summary')
    async getSummary(@CurrentUser() user: { id: string }) {
        return this.analyticsService.getUserSummary(user.id);
    }
}