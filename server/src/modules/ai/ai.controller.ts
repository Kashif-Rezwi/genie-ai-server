import { Controller, Post, Get, Body, UseGuards, Res, ValidationPipe } from '@nestjs/common';
import { Response } from 'express';
import { AIService } from './services/ai.service';
import { CreditService } from './services/credit.service';
import { AIRequestDto } from './dto/ai-request.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AI_MODELS, getFreeModels, getPaidModels } from '../../config/ai.config';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AIController {
    constructor(
        private readonly aiService: AIService,
        private readonly creditService: CreditService,
    ) { }

    @Get('models')
    async getAvailableModels() {
        return {
            all: Object.values(AI_MODELS),
            free: getFreeModels(),
            paid: getPaidModels(),
        };
    }

    @Get('credits')
    async getUserCredits(@CurrentUser() user: any) {
        const balance = await this.creditService.getUserBalance(user.id);
        const history = await this.creditService.getTransactionHistory(user.id, 10);

        return {
            balance,
            recentTransactions: history,
        };
    }

    // Non-streaming endpoint (uses streaming internally)
    @Post('generate')
    async generateResponse(
        @CurrentUser() user: any,
        @Body(ValidationPipe) request: AIRequestDto,
    ) {
        return this.aiService.generateResponse(user.id, request);
    }

    // Real-time streaming endpoint
    @Post('stream')
    async streamResponse(
        @CurrentUser() user: any,
        @Body(ValidationPipe) request: AIRequestDto,
        @Res() response: Response,
    ) {
        // Set headers for Server-Sent Events
        response.setHeader('Content-Type', 'text/event-stream');
        response.setHeader('Cache-Control', 'no-cache');
        response.setHeader('Connection', 'keep-alive');
        response.setHeader('Access-Control-Allow-Origin', '*');
        response.setHeader('Access-Control-Allow-Headers', 'Cache-Control, Content-Type, Authorization');

        try {
            const stream = this.aiService.streamResponse(user.id, request);

            for await (const chunk of stream) {
                if (chunk.error) {
                    response.write(`data: ${JSON.stringify({ error: chunk.error, done: true })}\n\n`);
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