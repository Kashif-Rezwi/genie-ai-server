import { Injectable } from '@nestjs/common';
import { anthropic } from '@ai-sdk/anthropic';
import { streamText, generateText } from 'ai';
import { AIRequestDto } from '../dto/ai-request.dto';
import { AIResponseDto } from '../dto/ai-response.dto';

@Injectable()
export class AnthropicProvider {
    async *streamResponse(request: AIRequestDto): AsyncGenerator<any, void, unknown> {
        const { messages, model = 'claude-3-haiku-20240307', maxTokens = 1000, temperature = 0.7 } = request;

        try {
            const result = streamText({
                model: anthropic(model),
                messages: messages.map(msg => ({
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

                yield {
                    id: `anthropic-stream-${Date.now()}`,
                    content: accumulatedText,
                    delta,
                    done: false,
                };
            }

            finalUsage = await result.usage;

            yield {
                id: `anthropic-final-${Date.now()}`,
                content: accumulatedText,
                delta: '',
                usage: {
                    promptTokens: finalUsage.inputTokens,
                    completionTokens: finalUsage.outputTokens,
                    totalTokens: finalUsage.totalTokens,
                },
                done: true,
            };
        } catch (error) {
            yield {
                error: `Anthropic streaming error: ${error.message}`,
                done: true,
            };
        }
    }

    async generateResponse(request: AIRequestDto): Promise<AIResponseDto> {
        const { messages, model = 'claude-3-haiku-20240307', maxTokens = 1000, temperature = 0.7 } = request;

        try {
            const result = await generateText({
                model: anthropic(model),
                messages: messages.map(msg => ({
                    role: msg.role,
                    content: msg.content,
                })),
                maxOutputTokens: maxTokens,
                temperature,
            });

            return {
                id: `anthropic-${Date.now()}`,
                content: result.text,
                model: request.model || 'claude-3-haiku-20240307',
                usage: {
                    promptTokens: result.usage.inputTokens,
                    completionTokens: result.usage.outputTokens,
                    totalTokens: result.usage.totalTokens,
                },
                creditsUsed: 0,
                finishReason: result.finishReason || 'stop',
            };
        } catch (error) {
            throw new Error(`Anthropic error: ${error.message}`);
        }
    }
}