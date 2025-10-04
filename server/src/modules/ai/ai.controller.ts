import { Controller, Post, Get, Body, UseGuards, Res, ValidationPipe } from '@nestjs/common';
import { Response } from 'express';
import { AIService } from './services/ai.service';
import { CreditsService } from '../credits/services/credits.service';
import { AIRequestDto } from './dto/ai-request.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AI_MODELS, getFreeModels, getPaidModels } from '../../config';
import { RateLimit, RateLimitGuard } from '../security/guards/rate-limit.guard';

@Controller('ai')
@UseGuards(JwtAuthGuard, RateLimitGuard)
export class AIController {
    constructor(
        private readonly aiService: AIService,
        private readonly creditsService: CreditsService,
    ) {}

    @Get('models')
    @RateLimit('api')
    async getAvailableModels() {
        return {
            all: Object.values(AI_MODELS),
            free: getFreeModels(),
            paid: getPaidModels(),
        };
    }

    @Get('credits')
    async getUserCredits(@CurrentUser() user: { id: string }) {
        const balance = await this.creditsService.getBalance(user.id);
        const transactions = await this.creditsService.getRecentTransactions(user.id);
        return {
            balance,
            recentTransactions: transactions,
        };
    }

    // Non-streaming endpoint (uses streaming internally)
    @Post('generate')
    @RateLimit('ai')
    async generateResponse(@CurrentUser() user: { id: string }, @Body(ValidationPipe) request: AIRequestDto) {
        return this.aiService.generateResponse(user.id, request);
    }

    // Queued endpoint for high-load scenarios
    @Post('generate-queued')
    @RateLimit('ai')
    async generateResponseQueued(@CurrentUser() user: { id: string }, @Body(ValidationPipe) request: AIRequestDto) {
        return this.aiService.generateResponseQueued(user.id, request);
    }

    // Get queue status
    @Get('queue/status')
    @RateLimit('api')
    async getQueueStatus() {
        return this.aiService.getQueueStatus();
    }

    // Get user queue status
    @Get('queue/user-status')
    @RateLimit('api')
    async getUserQueueStatus(@CurrentUser() user: { id: string }) {
        return this.aiService.getUserQueueStatus(user.id);
    }

    // Real-time streaming endpoint
    @Post('stream')
    @RateLimit('ai')
    async streamResponse(
        @CurrentUser() user: { id: string },
        @Body(ValidationPipe) request: AIRequestDto,
        @Res() response: Response,
    ) {
        // Set headers for Server-Sent Events
        response.setHeader('Content-Type', 'text/event-stream');
        response.setHeader('Cache-Control', 'no-cache');
        response.setHeader('Connection', 'keep-alive');
        response.setHeader('Access-Control-Allow-Origin', '*');
        response.setHeader(
            'Access-Control-Allow-Headers',
            'Cache-Control, Content-Type, Authorization',
        );

        try {
            const stream = this.aiService.streamResponse(user.id, request);

            for await (const chunk of stream) {
                if (chunk.error) {
                    response.write(
                        `data: ${JSON.stringify({ error: chunk.error, done: true })}\n\n`,
                    );
                    break;
                }

                response.write(`data: ${JSON.stringify(chunk)}\n\n`);

                if (chunk.done) {
                    break;
                }
            }

            response.write('data: [DONE]\n\n');
            response.end();
        } catch (error) {
            const errorData = {
                error: error.message,
                done: true,
            };
            response.write(`data: ${JSON.stringify(errorData)}\n\n`);
            response.end();
        }
    }
}
