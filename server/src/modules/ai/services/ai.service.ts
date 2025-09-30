import { Injectable, BadRequestException } from '@nestjs/common';
import { AIRequestDto } from '../dto/ai-request.dto';
import { AIResponseDto } from '../dto/ai-response.dto';

import { AIProviderFactory } from '../providers/ai-provider.factory';
import { AICreditService } from './ai-credit.service';
import { getModelConfig, AIModelConfig, aiProvidersConfig } from '../../../config';

@Injectable()
export class AIService {
    private readonly config = aiProvidersConfig();

    constructor(
        private readonly providerFactory: AIProviderFactory,
        private readonly aiCreditService: AICreditService,
    ) {}

    // Non-streaming endpoint (collects stream internally)
    async generateResponse(userId: string, request: AIRequestDto): Promise<AIResponseDto> {
        const modelId = request.model || this.config.defaultModel;
        const modelConfig = getModelConfig(modelId);

        if (!modelConfig) {
            throw new BadRequestException(`Model ${modelId} not supported`);
        }

        // Check credits for paid models
        await this.aiCreditService.checkCreditsForRequest(userId, request, modelConfig);

        // Use streaming internally but collect all chunks
        let response: AIResponseDto;
        let totalTokens = 0;

        try {
            response = await this.getProviderResponse(modelConfig.provider, {
                ...request,
                model: modelId,
            });
            totalTokens = response.usage.totalTokens;
        } catch (error) {
            throw new BadRequestException(`AI generation failed: ${error.message}`);
        }

        // Calculate and deduct credits
        const creditsUsed = await this.aiCreditService.deductCreditsForResponse(
            userId,
            response.usage.totalTokens,
            modelConfig,
            'AI generation'
        );
        response.creditsUsed = creditsUsed;

        return response;
    }

    // Streaming endpoint with real-time credit deduction
    async *streamResponse(
        userId: string,
        request: AIRequestDto,
    ): AsyncGenerator<any, void, unknown> {
        const modelId = request.model || this.config.defaultModel;
        const modelConfig = getModelConfig(modelId);

        if (!modelConfig) {
            throw new BadRequestException(`Model ${modelId} not supported`);
        }

        // Check credits for paid models
        await this.aiCreditService.checkCreditsForRequest(userId, request, modelConfig);

        // Stream response
        try {
            const stream = this.getProviderStream(modelConfig.provider, {
                ...request,
                model: modelId,
            });
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
                        try {
                            const creditsUsed = await this.aiCreditService.deductCreditsForResponse(
                                userId,
                                totalTokens,
                                modelConfig,
                                'AI streaming generation'
                            );

                            // Send credit info to client
                            yield {
                                id: `credits-${Date.now()}`,
                                creditsUsed,
                                totalTokens,
                                remainingBalance: await this.aiCreditService.getUserBalance(userId),
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

    private async getProviderResponse(
        provider: string,
        request: AIRequestDto,
    ): Promise<AIResponseDto> {
        const providerInstance = this.providerFactory.getProvider(provider);
        return providerInstance.generateResponse(request);
    }

    private getProviderStream(provider: string, request: AIRequestDto) {
        const providerInstance = this.providerFactory.getProvider(provider);
        return providerInstance.streamResponse(request);
    }

}
