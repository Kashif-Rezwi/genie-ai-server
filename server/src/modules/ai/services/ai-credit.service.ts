import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { CreditsService } from '../../credits/services/credits.service';
import { AIRequestDto } from '../dto/ai-request.dto';
import { AIModelConfig, getModelConfig } from '../../../config';

@Injectable()
export class AICreditService {
    constructor(private readonly creditsService: CreditsService) {}

    async getUserBalance(userId: string): Promise<number> {
        return this.creditsService.getUserBalance(userId);
    }

    async checkCreditsForRequest(userId: string, request: AIRequestDto, modelConfig: AIModelConfig): Promise<void> {
        if (!modelConfig.isFree) {
            const estimatedCost = this.estimateCredits(request, modelConfig);
            const balance = await this.creditsService.getUserBalance(userId);

            if (balance < estimatedCost) {
                throw new ForbiddenException(
                    `Insufficient credits. Required: ${estimatedCost}, Available: ${balance}`,
                );
            }
        }
    }

    async deductCreditsForResponse(
        userId: string,
        totalTokens: number,
        modelConfig: AIModelConfig,
        description: string = 'AI generation'
    ): Promise<number> {
        if (!modelConfig.isFree && totalTokens > 0) {
            const creditsUsed = this.calculateCreditsUsed(totalTokens, modelConfig);
            
            await this.creditsService.deductCredits(userId, creditsUsed, description, {
                model: modelConfig.name,
                tokens: totalTokens,
                provider: modelConfig.provider,
            });

            return creditsUsed;
        }
        return 0;
    }

    private estimateCredits(request: AIRequestDto, modelConfig: AIModelConfig): number {
        const estimatedTokens = (request.maxTokens || 1000) + 500;
        return this.calculateCreditsUsed(estimatedTokens, modelConfig);
    }

    private calculateCreditsUsed(tokens: number, modelConfig: AIModelConfig): number {
        return Math.ceil((tokens / 1000) * modelConfig.costPerToken * 100) / 100;
    }
}
