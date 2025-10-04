import { AIRequestDto } from '../dto/ai-request.dto';
import { AIResponseDto } from '../dto/ai-response.dto';

export interface AIProvider {
  streamResponse(request: AIRequestDto): AsyncGenerator<any, void, unknown>;
  generateResponse(request: AIRequestDto): Promise<AIResponseDto>;
}

export abstract class BaseAIProvider implements AIProvider {
  constructor() {}

  abstract streamResponse(request: AIRequestDto): AsyncGenerator<any, void, unknown>;
  abstract generateResponse(request: AIRequestDto): Promise<AIResponseDto>;

  protected processMessages(request: AIRequestDto) {
    const { messages, systemPrompt } = request;

    // Add system prompt to messages if provided
    const processedMessages = [...messages];
    if (systemPrompt) {
      processedMessages.unshift({
        role: 'system' as const,
        content: systemPrompt,
      });
    }

    return processedMessages;
  }

  protected createStreamChunk(
    id: string,
    content: string,
    delta: string,
    done: boolean = false,
    usage?: any,
    error?: string
  ) {
    const chunk: any = {
      id,
      content,
      delta,
      done,
    };

    if (usage) {
      chunk.usage = {
        promptTokens: usage.inputTokens || 0,
        completionTokens: usage.outputTokens || 0,
        totalTokens: usage.totalTokens || 0,
      };
    }

    if (error) {
      chunk.error = error;
    }

    return chunk;
  }

  protected createResponse(
    id: string,
    content: string,
    model: string,
    usage: any,
    finishReason: string = 'stop'
  ): AIResponseDto {
    return {
      id,
      content,
      model,
      usage: {
        promptTokens: usage.inputTokens || 0,
        completionTokens: usage.outputTokens || 0,
        totalTokens: usage.totalTokens || 0,
      },
      creditsUsed: 0, // Will be calculated by credit service
      finishReason,
    };
  }
}
