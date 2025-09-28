import {
    Controller,
    Post,
    Get,
    Body,
    Param,
    Query,
    UseGuards,
    ValidationPipe,
    Headers,
    RawBodyRequest,
    Req,
    HttpCode,
    HttpStatus,
    BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { PaymentsService } from './services/payments.service';
import { WebhookService } from './services/webhook.service';
import { PaymentHistoryService } from './services/payment-history.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RateLimit, RateLimitGuard } from '../security/guards/rate-limit.guard';
import {
    CreatePaymentOrderDto,
    VerifyPaymentDto,
    PaymentHistoryQueryDto,
    RefundPaymentDto,
} from './dto/payment.dto';
import { getActivePackages, paymentConfig } from '../../config';

@Controller('payments')
@UseGuards(RateLimitGuard)
export class PaymentsController {
    private readonly config = paymentConfig();

    constructor(
        private readonly paymentsService: PaymentsService,
        private readonly webhookService: WebhookService,
        private readonly historyService: PaymentHistoryService,
    ) {}

    @Get('packages')
    @UseGuards(JwtAuthGuard)
    async getPaymentPackages() {
        return {
            packages: getActivePackages(),
            currency: this.config.currency,
            razorpayKeyId: this.config.razorpay.keyId,
        };
    }

    @Post('create-order')
    @UseGuards(JwtAuthGuard)
    @RateLimit('payment', 5) // 5 payment orders per minute
    async createPaymentOrder(
        @CurrentUser() user: any,
        @Body(ValidationPipe) createOrderDto: CreatePaymentOrderDto,
    ) {
        return this.paymentsService.createPaymentOrder(user.id, createOrderDto);
    }

    @Post('verify')
    @UseGuards(JwtAuthGuard)
    @RateLimit('payment', 10) // 10 payment verifications per minute
    async verifyPayment(@Body(ValidationPipe) verifyDto: VerifyPaymentDto) {
        return this.paymentsService.verifyAndCompletePayment(verifyDto);
    }

    @Get('history')
    @UseGuards(JwtAuthGuard)
    async getPaymentHistory(
        @CurrentUser() user: any,
        @Query(ValidationPipe) query: PaymentHistoryQueryDto,
    ) {
        return this.paymentsService.getPaymentHistory(user.id, query);
    }

    @Get('stats')
    @UseGuards(JwtAuthGuard)
    async getPaymentStats(@CurrentUser() user: any) {
        const [paymentStats, userSummary] = await Promise.all([
            this.paymentsService.getPaymentStats(user.id),
            this.historyService.getUserPaymentSummary(user.id),
        ]);

        return {
            ...paymentStats,
            ...userSummary,
        };
    }

    @Get(':paymentId')
    @UseGuards(JwtAuthGuard)
    async getPaymentDetails(@CurrentUser() user: any, @Param('paymentId') paymentId: string) {
        return this.paymentsService.getPaymentById(paymentId, user.id);
    }

    @Post(':paymentId/cancel')
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.NO_CONTENT)
    async cancelPayment(@CurrentUser() user: any, @Param('paymentId') paymentId: string) {
        await this.paymentsService.cancelPayment(paymentId, user.id);
    }

    // Webhook endpoint - no auth required
    @Post('webhook/razorpay')
    @HttpCode(HttpStatus.OK)
    async handleRazorpayWebhook(
        @Req() req: RawBodyRequest<Request>,
        @Headers('x-razorpay-signature') signature: string,
    ) {
        const body = req.rawBody?.toString() || '';

        if (!signature) {
            throw new BadRequestException('Missing webhook signature');
        }

        return this.webhookService.handleRazorpayWebhook(body, signature);
    }

    // Admin endpoints
    @Get('admin/analytics')
    @UseGuards(JwtAuthGuard) // Add admin role guard later
    async getPaymentAnalytics(@Query('days') days: number = 30) {
        return this.historyService.getPaymentAnalytics(days);
    }

    @Get('admin/recent')
    @UseGuards(JwtAuthGuard) // Add admin role guard later
    async getRecentPayments(@Query('limit') limit: number = 10) {
        return this.historyService.getRecentPayments(limit);
    }

    @Get('admin/failed')
    @UseGuards(JwtAuthGuard) // Add admin role guard later
    async getFailedPayments(@Query('days') days: number = 7) {
        return this.historyService.getFailedPayments(days);
    }

    @Post('admin/:paymentId/retry')
    @UseGuards(JwtAuthGuard) // Add admin role guard later
    @HttpCode(HttpStatus.NO_CONTENT)
    async retryFailedPayment(@Param('paymentId') paymentId: string) {
        await this.webhookService.retryFailedPaymentProcessing(paymentId);
    }
}
