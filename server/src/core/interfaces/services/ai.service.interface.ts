// Define interfaces locally to avoid circular dependencies
export interface AIRequestDto {
  messages: Array<{ role: string; content: string }>;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AIResponseDto {
  id: string;
  content: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  creditsUsed: number;
  timestamp: Date;
}

/**
 * Interface for AI Service
 * Defines the contract for AI model operations
 */
export interface IAIService {
  /**
   * Generate AI response (non-streaming)
   * @param userId - The user's ID
   * @param request - The AI request data
   * @returns Promise<AIResponseDto> - The AI response
   */
  generateResponse(userId: string, request: AIRequestDto): Promise<AIResponseDto>;

  /**
   * Generate AI response (streaming)
   * @param userId - The user's ID
   * @param request - The AI request data
   * @returns AsyncGenerator<any, void, unknown> - Streaming response
   */
  streamResponse(
    userId: string,
    request: AIRequestDto
  ): AsyncGenerator<any, void, unknown>;

  /**
   * Get available AI models
   * @returns Promise<{ free: string[], paid: string[] }> - Available models
   */
  getAvailableModels(): Promise<{ free: string[]; paid: string[] }>;

  /**
   * Check if a model is supported
   * @param modelId - The model ID to check
   * @returns boolean - Whether the model is supported
   */
  isModelSupported(modelId: string): boolean;

  /**
   * Get model configuration
   * @param modelId - The model ID
   * @returns Promise<any> - Model configuration
   */
  getModelConfig(modelId: string): Promise<any>;

  /**
   * Estimate credits for a request
   * @param request - The AI request data
   * @param modelId - The model ID
   * @returns Promise<number> - Estimated credits needed
   */
  estimateCredits(request: AIRequestDto, modelId: string): Promise<number>;
}
