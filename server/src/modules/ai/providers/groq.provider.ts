import { Injectable } from '@nestjs/common';
import { groq } from '@ai-sdk/groq';
import { streamText, generateText } from 'ai';
import { AIRequestDto } from '../dto/ai-request.dto';
import { AIResponseDto } from '../dto/ai-response.dto';

@Injectable()
export class GroqProvider {
    async *streamResponse(request: AIRequestDto): AsyncGenerator<any, void, unknown> {
        const { messages, model = 'llama-3.1-8b-instant', maxTokens = 1000, temperature = 0.7 } = request;

        try {
            const result = streamText({
                model: groq(model),
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
                    id: `groq-stream-${Date.now()}`,
                    content: accumulatedText,
                    delta,
                    done: false,
                };
            }

            // Get final usage after stream completes
            finalUsage = await result.usage;

            // Final chunk with complete data
            yield {
                id: `groq-final-${Date.now()}`,
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
                error: `Groq streaming error: ${error.message}`,
                done: true,
            };
        }
    }

    // Non-streaming method using generateText
    async generateResponse(request: AIRequestDto): Promise<AIResponseDto> {
        const { messages, model = 'llama-3.1-8b-instant', maxTokens = 1000, temperature = 0.7 } = request;

        try {
            const result = await generateText({
                model: groq(model),
                messages: messages.map(msg => ({
                    role: msg.role,
                    content: msg.content,
                })),
                maxOutputTokens: maxTokens,
                temperature,
            });

            return {
                id: `groq-${Date.now()}`,
                content: result.text,
                model: request.model || 'llama-3.1-8b-instant',
                usage: {
                    promptTokens: result.usage.inputTokens || 0,
                    completionTokens: result.usage.outputTokens || 0,
                    totalTokens: result.usage.totalTokens || 0,
                },
                creditsUsed: 0, // Will be calculated by credit service
                finishReason: result.finishReason || 'stop',
            };
        } catch (error) {
            throw new Error(`Groq error: ${error.message}`);
        }
    }
}
