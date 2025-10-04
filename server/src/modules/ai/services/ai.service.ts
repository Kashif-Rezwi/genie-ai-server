import { Injectable, BadRequestException } from '@nestjs/common';
import { AIRequestDto } from '../dto/ai-request.dto';
import { AIResponseDto } from '../dto/ai-response.dto';
import { AIProviderFactory } from '../providers/ai-provider.factory';
import { CreditsService } from '../../credits/services/credits.service';
import { MetricsService } from '../../monitoring/services/metrics.service';
import { getModelConfig, AIModelConfig, aiProvidersConfig } from '../../../config';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AIService {
    private readonly config = aiProvidersConfig();

    constructor(
        private readonly providerFactory: AIProviderFactory,
        private readonly creditsService: CreditsService,
        private readonly metricsService: MetricsService,
    ) {}

    // Non-streaming endpoint (collects stream internally)
    async generateResponse(userId: string, request: AIRequestDto): Promise<AIResponseDto> {
        const modelId = request.model || this.config.defaultModel;
        const modelConfig = getModelConfig(modelId);

        if (!modelConfig) {
            throw new BadRequestException(`Model ${modelId} not supported`);
        }

        let reservationId: string | null = null;

        try {
            // For paid models, reserve credits
            if (!modelConfig.isFree) {
                const estimatedCredits = this.estimateCredits(request, modelConfig);
                reservationId = await this.creditsService.reserveCredits(userId, estimatedCredits, {
                    model: modelConfig.name,
                    provider: modelConfig.provider,
                    operation: 'generate',
                    requestId: uuidv4(),
                });
            }

            // Process AI request
            const response = await this.getProviderResponse(modelConfig.provider, {
                ...request,
                model: modelId,
            });

            // Calculate actual credits used
            const actualCredits = this.calculateCreditsUsed(
                response.usage.totalTokens,
                modelConfig,
            );

            // Confirm reservation with actual amount
            if (reservationId) {
                await this.creditsService.confirmReservation(reservationId, actualCredits);
            }

            response.creditsUsed = actualCredits;
            
            // Record AI request metrics
            this.metricsService.recordAIRequest(actualCredits);
            
            return response;
        } catch (error) {
            // Release reservation on any failure
            if (reservationId) {
                await this.creditsService.releaseReservation(reservationId);
            }
            throw error;
        }
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

        let reservationId: string | null = null;

        try {
            // For paid models, reserve credits
            if (!modelConfig.isFree) {
                const estimatedCredits = this.estimateCredits(request, modelConfig);
                reservationId = await this.creditsService.reserveCredits(userId, estimatedCredits, {
                    model: modelConfig.name,
                    provider: modelConfig.provider,
                    operation: 'stream',
                    requestId: uuidv4(),
                });
            }

            // Stream response
            const stream = this.getProviderStream(modelConfig.provider, {
                ...request,
                model: modelId,
            });
            let totalTokens = 0;
            let creditsConfirmed = false;

            for await (const chunk of stream) {
                // Forward chunk to client immediately
                yield {
                    ...chunk,
                    model: modelId,
                };

                // Handle final chunk with usage data
                if (chunk.done && chunk.usage?.totalTokens && !creditsConfirmed) {
                    totalTokens = chunk.usage.totalTokens;

                    // Confirm reservation with actual amount
                    if (reservationId && totalTokens > 0) {
                        let actualCredits = 0;
                        try {
                            actualCredits = this.calculateCreditsUsed(
                                totalTokens,
                                modelConfig,
                            );

                            await this.creditsService.confirmReservation(
                                reservationId,
                                actualCredits,
                            );

                            // Send credit info to client
                            yield {
                                id: `credits-${Date.now()}`,
                                creditsUsed: actualCredits,
                                totalTokens,
                                remainingBalance: await this.creditsService.getBalance(userId),
                                done: true,
                                type: 'credit_update',
                            };
                        } catch (creditError) {
                            yield {
                                error: `Credit confirmation failed: ${creditError.message}`,
                                done: true,
                                type: 'credit_error',
                            };
                        }
                        creditsConfirmed = true;
                        
                        // Record AI request metrics for streaming
                        this.metricsService.recordAIRequest(actualCredits);
                    }
                }

                // Handle errors
                if (chunk.error) {
                    break;
                }
            }
        } catch (error) {
            // Release reservation on any failure
            if (reservationId) {
                await this.creditsService.releaseReservation(reservationId);
            }
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

    private estimateCredits(request: AIRequestDto, modelConfig: AIModelConfig): number {
        const estimatedTokens = (request.maxTokens || 1000) + 500;
        return this.calculateCreditsUsed(estimatedTokens, modelConfig);
    }

    private calculateCreditsUsed(tokens: number, modelConfig: AIModelConfig): number {
        return Math.ceil((tokens / 1000) * modelConfig.costPerToken * 100) / 100;
    }
}
