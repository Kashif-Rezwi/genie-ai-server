import { IAIService, AIRequestDto, AIResponseDto } from '../../interfaces/services';

/**
 * Mock implementation of IAIService for testing
 */
export class MockAIService implements IAIService {
  private mockResponse = 'This is a mock AI response';
  private mockModels = ['gpt-3.5-turbo', 'gpt-4', 'claude-3-haiku-20240307'];

  async generateResponse(userId: string, request: AIRequestDto): Promise<AIResponseDto> {
    return {
      id: `ai_${Date.now()}`,
      content: this.mockResponse,
      model: request.model || 'gpt-3.5-turbo',
      usage: {
        promptTokens: request.messages?.length || 0,
        completionTokens: 50,
        totalTokens: (request.messages?.length || 0) + 50,
      },
      creditsUsed: 1,
      timestamp: new Date(),
    };
  }

  async *streamResponse(
    userId: string,
    request: AIRequestDto
  ): AsyncGenerator<any, void, unknown> {
    const words = this.mockResponse.split(' ');
    for (let i = 0; i < words.length; i++) {
      yield {
        id: `ai_${Date.now()}`,
        content: words[i] + (i < words.length - 1 ? ' ' : ''),
        model: request.model || 'gpt-3.5-turbo',
        usage: {
          promptTokens: request.messages?.length || 0,
          completionTokens: i + 1,
          totalTokens: (request.messages?.length || 0) + i + 1,
        },
        creditsUsed: 1,
        timestamp: new Date(),
        done: i === words.length - 1,
      };
    }
  }

  async getAvailableModels(): Promise<{ free: string[]; paid: string[] }> {
    return {
      free: ['gpt-3.5-turbo'],
      paid: ['gpt-4', 'claude-3-haiku-20240307'],
    };
  }

  isModelSupported(modelId: string): boolean {
    return this.mockModels.includes(modelId);
  }

  async getModelConfig(modelId: string): Promise<any> {
    return {
      id: modelId,
      name: modelId,
      provider: 'openai',
      maxTokens: 4096,
      costPerToken: 0.0001,
    };
  }

  async estimateCredits(request: AIRequestDto, modelId: string): Promise<number> {
    const baseCredits = 1;
    const messageCount = request.messages?.length || 0;
    const estimatedTokens = messageCount * 10; // Rough estimate
    return Math.ceil(estimatedTokens / 100) + baseCredits;
  }

  // Test helpers
  setMockResponse(response: string): void {
    this.mockResponse = response;
  }

  setMockModels(models: string[]): void {
    this.mockModels = models;
  }
}
