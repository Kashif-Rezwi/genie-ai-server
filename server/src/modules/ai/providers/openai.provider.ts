import { Injectable } from '@nestjs/common';
import { openai } from '@ai-sdk/openai';
import { streamText, generateText } from 'ai';
import { AIRequestDto } from '../dto/ai-request.dto';
import { AIResponseDto } from '../dto/ai-response.dto';

@Injectable()
export class OpenAIProvider {
    // Primary method - always use streaming
    async *streamResponse(request: AIRequestDto): AsyncGenerator<any, void, unknown> {
        const { messages, model = 'gpt-3.5-turbo', maxTokens = 1000, temperature = 0.7 } = request;

        try {
            const result = streamText({
                model: openai(model),
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
                    id: `openai-stream-${Date.now()}`,
                    content: accumulatedText,
                    delta,
                    done: false,
                };
            }

            // Get final usage after stream completes
            finalUsage = await result.usage;

            // Final chunk with complete data
            yield {
                id: `openai-final-${Date.now()}`,
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
                error: `OpenAI streaming error: ${error.message}`,
                done: true,
            };
        }
    }

    // Non-streaming method using generateText
    async generateResponse(request: AIRequestDto): Promise<AIResponseDto> {
        const { messages, model = 'gpt-3.5-turbo', maxTokens = 1000, temperature = 0.7 } = request;

        try {
            const result = await generateText({
                model: openai(model),
                messages: messages.map(msg => ({
                    role: msg.role,
                    content: msg.content,
                })),
                maxOutputTokens: maxTokens,
                temperature,
            });

            return {
                id: `openai-${Date.now()}`,
                content: result.text,
                model: request.model || 'gpt-3.5-turbo',
                usage: {
                    promptTokens: result.usage.inputTokens || 0,
                    completionTokens: result.usage.outputTokens || 0,
                    totalTokens: result.usage.totalTokens || 0,
                },
                creditsUsed: 0, // Will be calculated by credit service
                finishReason: result.finishReason || 'stop',
            };
        } catch (error) {
            throw new Error(`OpenAI error: ${error.message}`);
        }
    }
}
