import { Controller, Get, Post, Body, Query, Param, UseGuards, ValidationPipe } from '@nestjs/common';
import { CreditsService } from './services/credits.service';
import { CreditsAnalyticsService } from './services/credits-analytics.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RateLimit, RateLimitGuard } from '../security/guards/rate-limit.guard';
import {
    AddCreditsDto,
    TransferCreditsDto,
    BatchAddCreditsDto,
    TransactionHistoryQueryDto
} from './dto/credits.dto';
import { getActivePackages } from '../../config/credit-packages.config';

@Controller('credits')
@UseGuards(JwtAuthGuard, RateLimitGuard)
export class CreditsController {
    constructor(
        private readonly creditsService: CreditsService,
        private readonly analyticsService: CreditsAnalyticsService,
    ) { }

    @Get('balance')
    async getBalance(@CurrentUser() user: any) {
        const balance = await this.creditsService.getUserBalance(user.id);
        const isLowCredit = await this.creditsService.checkLowCreditAlert(user.id);

        return {
            balance,
            isLowCredit,
            lastUpdated: new Date(),
        };
    }

    @Get('packages')
    async getCreditPackages() {
        return {
            packages: getActivePackages(),
            currency: 'INR',
        };
    }

    @Get('summary')
    async getCreditSummary(@CurrentUser() user: any) {
        return this.creditsService.getUserCreditSummary(user.id);
    }

    @Get('history')
    async getTransactionHistory(
        @CurrentUser() user: any,
        @Query(ValidationPipe) query: TransactionHistoryQueryDto,
    ) {
        return this.creditsService.getTransactionHistory(user.id, query);
    }

    @Get('analytics/personal')
    async getPersonalAnalytics(@CurrentUser() user: any) {
        return this.analyticsService.getUserSpendingPattern(user.id);
    }

    @Post('transfer')
    async transferCredits(
        @CurrentUser() user: any,
        @Body(ValidationPipe) transferDto: TransferCreditsDto,
    ) {
        // Ensure user can only transfer from their own account
        if (transferDto.fromUserId !== user.id) {
            throw new Error('You can only transfer from your own account');
        }

        return this.creditsService.transferCredits(
            transferDto.fromUserId,
            transferDto.toUserId,
            transferDto.amount,
            transferDto.description,
        );
    }

    // Admin endpoints (we'll add role-based guards later)
    @Post('admin/add')
    async adminAddCredits(@Body(ValidationPipe) addCreditsDto: AddCreditsDto) {
        return this.creditsService.addCredits(
            addCreditsDto.userId,
            addCreditsDto.amount,
            addCreditsDto.description,
            addCreditsDto.razorpayPaymentId,
            addCreditsDto.packageId,
        );
    }

    @Post('admin/batch-add')
    async adminBatchAddCredits(@Body(ValidationPipe) batchDto: BatchAddCreditsDto) {
        return this.creditsService.batchAddCredits(batchDto.operations);
    }

    @Get('admin/analytics')
    async getAdminAnalytics() {
        return this.analyticsService.getOverallAnalytics();
    }

    @Get('admin/user/:userId/summary')
    async getAdminUserSummary(@Param('userId') userId: string) {
        return this.creditsService.getUserCreditSummary(userId);
    }
}