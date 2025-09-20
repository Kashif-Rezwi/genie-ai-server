import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { AIRequestDto } from '../dto/ai-request.dto';
import { AIResponseDto } from '../dto/ai-response.dto';

import { CreditService } from './credit.service';
import { OpenAIProvider } from '../providers/openai.provider';
import { AnthropicProvider } from '../providers/anthropic.provider';
import { GroqProvider } from '../providers/groq.provider';
import { getModelConfig, AIModelConfig } from '../../../config/ai.config';

@Injectable()
export class AIService {
    constructor(
        private readonly creditService: CreditService,
        private readonly openaiProvider: OpenAIProvider,
        private readonly anthropicProvider: AnthropicProvider,
        private readonly groqProvider: GroqProvider,
    ) { }

    // Non-streaming endpoint (collects stream internally)
    async generateResponse(userId: string, request: AIRequestDto): Promise<AIResponseDto> {
        const modelId = request.model || process.env.DEFAULT_AI_MODEL || 'llama-3.1-8b-instant';
        const modelConfig = getModelConfig(modelId);

        if (!modelConfig) {
            throw new BadRequestException(`Model ${modelId} not supported`);
        }

        // Pre-check credits for paid models
        if (!modelConfig.isFree) {
            const estimatedCost = this.estimateCredits(request, modelConfig);
            const hasCredits = await this.creditService.checkSufficientCredits(userId, estimatedCost);

            if (!hasCredits) {
                throw new ForbiddenException('Insufficient credits');
            }
        }

        // Use streaming internally but collect all chunks
        let response: AIResponseDto;
        let totalTokens = 0;

        try {
            response = await this.getProviderResponse(modelConfig.provider, { ...request, model: modelId });
            totalTokens = response.usage.totalTokens;
        } catch (error) {
            throw new BadRequestException(`AI generation failed: ${error.message}`);
        }

        // Calculate and deduct credits
        const creditsUsed = this.calculateCreditsUsed(totalTokens, modelConfig);
        response.creditsUsed = creditsUsed;

        if (!modelConfig.isFree && creditsUsed > 0) {
            await this.creditService.deductCredits(
                userId,
                creditsUsed,
                'AI generation',
                modelConfig.name
            );
        }

        return response;
    }

    // Streaming endpoint with real-time credit deduction
    async *streamResponse(userId: string, request: AIRequestDto): AsyncGenerator<any, void, unknown> {
        const modelId = request.model || process.env.DEFAULT_AI_MODEL || 'llama-3.1-8b-instant';
        const modelConfig = getModelConfig(modelId);

        if (!modelConfig) {
            throw new BadRequestException(`Model ${modelId} not supported`);
        }

        // Pre-check credits for paid models
        if (!modelConfig.isFree) {
            const estimatedCost = this.estimateCredits(request, modelConfig);
            const hasCredits = await this.creditService.checkSufficientCredits(userId, estimatedCost);

            if (!hasCredits) {
                throw new ForbiddenException('Insufficient credits');
            }
        }

        // Stream response
        try {
            const stream = this.getProviderStream(modelConfig.provider, { ...request, model: modelId });
            let totalTokens = 0;
            let creditsDeducted = false;

            for await (const chunk of stream) {
                // Forward chunk to client immediately
                yield {
                    ...chunk,
                    model: modelId,
                };

                // Handle final chunk with usage data
                if (chunk.done && chunk.usage?.totalTokens && !creditsDeducted) {
                    totalTokens = chunk.usage.totalTokens;

                    // Deduct credits after streaming completes
                    if (!modelConfig.isFree && totalTokens > 0) {
                        const creditsUsed = this.calculateCreditsUsed(totalTokens, modelConfig);

                        try {
                            await this.creditService.deductCredits(
                                userId,
                                creditsUsed,
                                'AI streaming generation',
                                modelConfig.name
                            );

                            // Send credit info to client
                            yield {
                                id: `credits-${Date.now()}`,
                                creditsUsed,
                                totalTokens,
                                remainingBalance: await this.creditService.getUserBalance(userId),
                                done: true,
                                type: 'credit_update',
                            };
                        } catch (creditError) {
                            yield {
                                error: `Credit deduction failed: ${creditError.message}`,
                                done: true,
                                type: 'credit_error',
                            };
                        }
                        creditsDeducted = true;
                    }
                }

                // Handle errors
                if (chunk.error) {
                    break;
                }
            }
        } catch (error) {
            yield {
                error: `AI streaming failed: ${error.message}`,
                done: true,
            };
        }
    }

    private async getProviderResponse(provider: string, request: AIRequestDto): Promise<AIResponseDto> {
        switch (provider) {
            case 'openai':
                return this.openaiProvider.generateResponse(request);
            case 'anthropic':
                return this.anthropicProvider.generateResponse(request);
            case 'groq':
                return this.groqProvider.generateResponse(request);
            default:
                throw new BadRequestException(`Provider ${provider} not supported`);
        }
    }

    private getProviderStream(provider: string, request: AIRequestDto) {
        switch (provider) {
            case 'openai':
                return this.openaiProvider.streamResponse(request);
            case 'anthropic':
                return this.anthropicProvider.streamResponse(request);
            case 'groq':
                return this.groqProvider.streamResponse(request);
            default:
                throw new BadRequestException(`Provider ${provider} not supported`);
        }
    }

    private estimateCredits(request: AIRequestDto, modelConfig: AIModelConfig): number {
        const estimatedTokens = (request.maxTokens || 1000) + 500;
        return this.calculateCreditsUsed(estimatedTokens, modelConfig);
    }

    private calculateCreditsUsed(tokens: number, modelConfig: AIModelConfig): number {
        return Math.ceil((tokens / 1000) * modelConfig.costPerToken * 100) / 100;
    }
}