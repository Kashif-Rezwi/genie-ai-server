import { Injectable } from '@nestjs/common';
import { streamText, generateText } from 'ai';
import { AIRequestDto } from '../dto/ai-request.dto';
import { AIResponseDto } from '../dto/ai-response.dto';
import { BaseAIProvider } from './base-ai.provider';

@Injectable()
export class GenericAIProvider extends BaseAIProvider {
    constructor(
        private readonly providerFunction: any,
        private readonly defaultModel: string,
        private readonly providerName: string,
    ) {
        super();
    }

    async *streamResponse(request: AIRequestDto): AsyncGenerator<any, void, unknown> {
        const { model = this.defaultModel, maxTokens = 1000, temperature = 0.7 } = request;
        const processedMessages = this.processMessages(request);

        try {
            const result = streamText({
                model: this.providerFunction(model),
                messages: processedMessages.map(msg => ({
                    role: msg.role,
                    content: msg.content,
                })),
                maxOutputTokens: maxTokens,
                temperature,
            });

            let accumulatedText = '';
            let finalUsage = null;

            for await (const delta of result.textStream) {
                accumulatedText += delta;

                yield this.createStreamChunk(
                    `${this.providerName}-stream-${Date.now()}`,
                    accumulatedText,
                    delta,
                    false
                );
            }

            finalUsage = await result.usage;

            yield this.createStreamChunk(
                `${this.providerName}-final-${Date.now()}`,
                accumulatedText,
                '',
                true,
                finalUsage
            );
        } catch (error) {
            yield this.createStreamChunk(
                `${this.providerName}-error-${Date.now()}`,
                '',
                '',
                true,
                undefined,
                `${this.providerName} streaming error: ${error.message}`
            );
        }
    }

    async generateResponse(request: AIRequestDto): Promise<AIResponseDto> {
        const { model = this.defaultModel, maxTokens = 1000, temperature = 0.7 } = request;
        const processedMessages = this.processMessages(request);

        try {
            const result = await generateText({
                model: this.providerFunction(model),
                messages: processedMessages.map(msg => ({
                    role: msg.role,
                    content: msg.content,
                })),
                maxOutputTokens: maxTokens,
                temperature,
            });

            return this.createResponse(
                `${this.providerName}-${Date.now()}`,
                result.text,
                request.model || this.defaultModel,
                result.usage,
                result.finishReason || 'stop'
            );
        } catch (error) {
            throw new Error(`${this.providerName} error: ${error.message}`);
        }
    }
}
