import { Injectable, BadRequestException } from '@nestjs/common';
import { Response } from 'express';
import { ChatService } from './chat.service';
import { MessageService } from './message.service';
import { AIService } from '../../ai/services/ai.service';
import { CreditsService } from '../../credits/services/credits.service';
import { LoggingService } from '../../monitoring/services/logging.service';
import { SendMessageDto } from '../dto/chat.dto';
import { StreamingChatResponseDto } from '../dto/message.dto';
import { getModelConfig, aiProvidersConfig } from '../../../config';

@Injectable()
export class ChatStreamingService {
  private readonly config = aiProvidersConfig();
  private readonly activeStreams = new Map<string, boolean>();

  constructor(
    private readonly chatService: ChatService,
    private readonly messageService: MessageService,
    private readonly aiService: AIService,
    private readonly creditsService: CreditsService,
    private readonly loggingService: LoggingService
  ) {}

  async streamChatResponse(
    chatId: string,
    userId: string,
    sendMessageDto: SendMessageDto,
    response: Response
  ): Promise<void> {
    const { content, model, systemPrompt } = sendMessageDto;
    const streamKey = `${chatId}-${userId}`;
    let isClientConnected = true;
    let cleanupExecuted = false;

    // Check if there's already an active stream for this chat
    if (this.activeStreams.has(streamKey)) {
      throw new BadRequestException(
        'Another message is already being processed for this chat. Please wait.'
      );
    }

    // Mark stream as active
    this.activeStreams.set(streamKey, true);

    // Setup cleanup function
    const cleanup = () => {
      if (cleanupExecuted) return;
      cleanupExecuted = true;
      this.activeStreams.delete(streamKey);
      this.loggingService.logInfo('Stream cleanup executed', { chatId, userId });
    };

    // Handle client disconnection
    response.on('close', () => {
      isClientConnected = false;
      this.loggingService.logInfo('Client disconnected during streaming', { chatId, userId });
      cleanup();
    });

    response.on('error', error => {
      this.loggingService.logError('Stream response error', error, { chatId, userId });
      isClientConnected = false;
      cleanup();
    });

    try {
      // Step 1: Verify chat exists and belongs to user
      const chat = await this.chatService.getChatById(chatId, userId);

      // Step 2: Save user message to database
      const userMessage = await this.messageService.addUserMessage(chatId, userId, content);

      // Step 3: Get conversation history
      const conversationHistory = await this.messageService.getConversationHistory(chatId, userId);

      // Step 4: Use system prompt from request or chat
      const effectiveSystemPrompt = systemPrompt || chat.systemPrompt;
      if (effectiveSystemPrompt && !conversationHistory.find(m => m.role === 'system')) {
        conversationHistory.unshift({
          role: 'system',
          content: effectiveSystemPrompt,
        });
      }

      // Step 5: Prepare AI request
      const modelId = model || this.config.defaultModel;
      const modelConfig = getModelConfig(modelId);

      if (!modelConfig) {
        throw new BadRequestException(`Model ${modelId} not supported`);
      }

      // Step 6: Check credits for paid models
      if (!modelConfig.isFree) {
        const balance = await this.creditsService.getBalance(userId);
        const estimatedCost = this.estimateCredits(content, modelConfig);

        if (balance < estimatedCost) {
          const errorResponse: StreamingChatResponseDto = {
            chatId,
            messageId: '',
            content: '',
            delta: '',
            done: true,
            error: `Insufficient credits. Required: ${estimatedCost}, Available: ${balance}`,
          };

          this.writeSSEData(response, errorResponse);
          response.end();
          return;
        }
      }

      // Step 7: Start AI streaming
      let fullContent = '';
      let messageId = '';
      let totalTokens = 0;

      const aiRequest = {
        messages: conversationHistory,
        model: modelId,
        maxTokens: 2000,
        temperature: 0.7,
      };

      const stream = this.aiService.streamResponse(userId, aiRequest);

      for await (const chunk of stream) {
        // Check if client is still connected
        if (!isClientConnected) {
          this.loggingService.logInfo('Client disconnected, stopping stream processing', {
            chatId,
            userId,
          });
          break;
        }

        // Accumulate content
        if (chunk.delta) {
          fullContent += chunk.delta;
        }

        // Track tokens for final cost calculation
        if (chunk.usage?.totalTokens) {
          totalTokens = chunk.usage.totalTokens;
        }

        // Send streaming response to client only if still connected
        if (isClientConnected) {
          const streamResponse: StreamingChatResponseDto = {
            chatId,
            messageId: messageId || `temp-${Date.now()}`,
            content: fullContent,
            delta: chunk.delta || '',
            model: modelId,
            done: chunk.done,
          };

          try {
            this.writeSSEData(response, streamResponse);
          } catch (writeError) {
            this.loggingService.logError('Failed to write SSE data', writeError, {
              chatId,
              userId,
            });
            isClientConnected = false;
            break;
          }
        }

        // If this is the final chunk, save to database
        if (chunk.done) {
          const creditsUsed = chunk.creditsUsed || 0;

          // Save assistant message to database
          const assistantMessage = await this.messageService.addAssistantMessage(
            chatId,
            userId,
            fullContent,
            modelId,
            creditsUsed
          );

          messageId = assistantMessage.id;

          // Send final response with correct message ID and credit info
          if (isClientConnected) {
            const finalResponse: StreamingChatResponseDto = {
              chatId,
              messageId,
              content: fullContent,
              delta: '',
              model: modelId,
              creditsUsed,
              done: true,
            };

            try {
              this.writeSSEData(response, finalResponse);
            } catch (writeError) {
              this.loggingService.logError('Failed to write final SSE data', writeError, {
                chatId,
                userId,
              });
            }
          }
        }
      }

      // Only end response if client is still connected
      if (isClientConnected) {
        response.end();
      }
    } catch (error) {
      this.loggingService.logError('Streaming error occurred', error, {
        chatId,
        userId,
        content: sendMessageDto.content,
      });

      // Only send error response if client is still connected
      if (isClientConnected) {
        const errorResponse: StreamingChatResponseDto = {
          chatId,
          messageId: '',
          content: '',
          delta: '',
          done: true,
          error: error.message || 'An error occurred during streaming',
        };

        try {
          this.writeSSEData(response, errorResponse);
          response.end();
        } catch (writeError) {
          this.loggingService.logError('Failed to write error response', writeError, {
            chatId,
            userId,
          });
        }
      }
    } finally {
      cleanup();
    }
  }

  private writeSSEData(response: Response, data: StreamingChatResponseDto): void {
    const jsonData = JSON.stringify(data);
    response.write(`data: ${jsonData}\n\n`);
  }

  private estimateCredits(content: string, modelConfig: { costPerToken: number }): number {
    // More accurate token estimation
    // For English text: ~4 characters per token
    // For code/mixed content: ~3 characters per token
    // For non-English: ~2 characters per token

    const isCodeContent = /[{}();=<>]/.test(content) || content.includes('```');
    const hasNonEnglish = /[^\x00-\x7F]/.test(content);

    let charsPerToken = 4; // Default for English text

    if (isCodeContent) {
      charsPerToken = 3;
    } else if (hasNonEnglish) {
      charsPerToken = 2;
    }

    const estimatedInputTokens = Math.ceil(content.length / charsPerToken);
    const estimatedOutputTokens = Math.min(1000, Math.max(100, estimatedInputTokens * 0.5)); // Dynamic output estimation
    const totalEstimatedTokens = estimatedInputTokens + estimatedOutputTokens;

    return Math.ceil((totalEstimatedTokens / 1000) * modelConfig.costPerToken * 100) / 100;
  }

  async handleQuickResponse(
    chatId: string,
    userId: string,
    sendMessageDto: SendMessageDto
  ): Promise<{
    userMessage: { id: string; content: string; role: string; createdAt: Date };
    assistantMessage: {
      id: string;
      content: string;
      role: string;
      model?: string;
      creditsUsed: number;
      createdAt: Date;
    };
    creditsUsed: number;
  }> {
    try {
      const { content, model } = sendMessageDto;

      this.loggingService.logInfo('Processing quick response', {
        chatId,
        userId,
        contentLength: content.length,
        model: model || this.config.defaultModel,
      });

      // Step 1: Save user message
      const userMessage = await this.messageService.addUserMessage(chatId, userId, content);

      // Step 2: Get conversation history
      const conversationHistory = await this.messageService.getConversationHistory(chatId, userId);

      // Step 3: Generate AI response (non-streaming)
      const aiRequest = {
        messages: conversationHistory,
        model: model || this.config.defaultModel,
        maxTokens: 1000,
        temperature: 0.7,
      };

      const aiResponse = await this.aiService.generateResponse(userId, aiRequest);

      // Step 4: Save assistant message
      const assistantMessage = await this.messageService.addAssistantMessage(
        chatId,
        userId,
        aiResponse.content,
        aiResponse.model,
        aiResponse.creditsUsed
      );

      this.loggingService.logInfo('Quick response completed successfully', {
        chatId,
        userId,
        creditsUsed: aiResponse.creditsUsed,
        responseLength: aiResponse.content.length,
      });

      return {
        userMessage,
        assistantMessage,
        creditsUsed: aiResponse.creditsUsed,
      };
    } catch (error) {
      this.loggingService.logError('Quick response failed', error, {
        stack: error.stack,
        chatId,
        userId,
        content: sendMessageDto.content,
      });
      throw error;
    }
  }
}
