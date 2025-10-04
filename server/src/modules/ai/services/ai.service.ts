import { Injectable, BadRequestException } from '@nestjs/common';
import { AIRequestDto } from '../dto/ai-request.dto';
import { AIResponseDto } from '../dto/ai-response.dto';
import { AIProviderFactory } from '../providers/ai-provider.factory';
import { AIQueueService } from './ai-queue.service';
import { CreditsService } from '../../credits/services/credits.service';
import { MetricsService } from '../../monitoring/services/metrics.service';
import { getModelConfig, AIModelConfig, aiProvidersConfig } from '../../../config';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AIService {
    private readonly config = aiProvidersConfig();

    constructor(
        private readonly providerFactory: AIProviderFactory,
        private readonly aiQueueService: AIQueueService,
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

    // Queued version for high-load scenarios (1000+ users)
    async generateResponseQueued(userId: string, request: AIRequestDto): Promise<AIResponseDto> {
        const modelId = request.model || this.config.defaultModel;
        const modelConfig = getModelConfig(modelId);

        if (!modelConfig) {
            throw new BadRequestException(`Model ${modelId} not supported`);
        }

        // Determine priority based on user tier or request type
        const priority = this.getRequestPriority(userId, request);
        
        // Use queue for processing
        const queuePayload = {
            userId,
            request,
            modelId,
            modelConfig,
            timestamp: Date.now(),
        };

        try {
            const result = await this.aiQueueService.enqueueRequest(
                userId,
                queuePayload,
                priority,
                2 // max retries
            );

            // Process the actual AI request
            return await this.processQueuedRequest(result);
        } catch (error) {
            throw new BadRequestException(`AI request failed: ${error.message}`);
        }
    }

    private getRequestPriority(userId: string, request: AIRequestDto): number {
        // Priority 1 = highest, 5 = lowest
        // You can implement user tier logic here
        if (request.priority === 'high') return 1;
        if (request.priority === 'low') return 5;
        
        // Default priority based on request type
        if (request.stream) return 2; // Streaming requests get higher priority
        return 3; // Default priority
    }

    private async processQueuedRequest(queueResult: any): Promise<AIResponseDto> {
        const { userId, request, modelId, modelConfig } = queueResult;
        
        // This would contain the actual AI processing logic
        // For now, return a mock response
        return {
            id: uuidv4(),
            content: `Queued AI response for user ${userId}`,
            model: modelId,
            provider: modelConfig.provider,
            usage: {
                promptTokens: 100,
                completionTokens: 50,
                totalTokens: 150,
            },
            creditsUsed: 0.15,
            finishReason: 'stop',
            timestamp: new Date().toISOString(),
        };
    }

    // Get queue status for monitoring
    getQueueStatus() {
        return this.aiQueueService.getQueueStatus();
    }

    // Get user-specific queue status
    getUserQueueStatus(userId: string) {
        return this.aiQueueService.getUserQueueStatus(userId);
    }
}
