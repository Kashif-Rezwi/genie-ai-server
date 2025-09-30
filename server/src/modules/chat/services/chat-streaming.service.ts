import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Response } from 'express';
import { ChatService } from './chat.service';
import { MessageService } from './message.service';
import { AIService } from '../../ai/services/ai.service';
import { CreditsService } from '../../credits/services/credits.service';
import { SendMessageDto } from '../dto/chat.dto';
import { StreamingChatResponseDto } from '../dto/message.dto';
import { getModelConfig, aiProvidersConfig } from '../../../config';

@Injectable()
export class ChatStreamingService {
    private readonly config = aiProvidersConfig();

    constructor(
        private readonly chatService: ChatService,
        private readonly messageService: MessageService,
        private readonly aiService: AIService,
        private readonly creditsService: CreditsService,
    ) {}

    async streamChatResponse(
        chatId: string,
        userId: string,
        sendMessageDto: SendMessageDto,
        response: Response,
    ): Promise<void> {
        const { content, model, systemPrompt } = sendMessageDto;

        try {
            // Step 1: Verify chat exists and belongs to user
            const chat = await this.chatService.getChatById(chatId, userId);

            // Step 2: Save user message to database
            const userMessage = await this.messageService.addUserMessage(chatId, userId, content);

            // Step 3: Get conversation history
            const conversationHistory = await this.messageService.getConversationHistory(
                chatId,
                userId,
            );

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
                // Accumulate content
                if (chunk.delta) {
                    fullContent += chunk.delta;
                }

                // Track tokens for final cost calculation
                if (chunk.usage?.totalTokens) {
                    totalTokens = chunk.usage.totalTokens;
                }

                // Send streaming response to client
                const streamResponse: StreamingChatResponseDto = {
                    chatId,
                    messageId: messageId || `temp-${Date.now()}`,
                    content: fullContent,
                    delta: chunk.delta || '',
                    model: modelId,
                    done: chunk.done,
                };

                this.writeSSEData(response, streamResponse);

                // If this is the final chunk, save to database
                if (chunk.done) {
                    const creditsUsed = chunk.creditsUsed || 0;

                    // Save assistant message to database
                    const assistantMessage = await this.messageService.addAssistantMessage(
                        chatId,
                        userId,
                        fullContent,
                        modelId,
                        creditsUsed,
                    );

                    messageId = assistantMessage.id;

                    // Send final response with correct message ID and credit info
                    const finalResponse: StreamingChatResponseDto = {
                        chatId,
                        messageId,
                        content: fullContent,
                        delta: '',
                        model: modelId,
                        creditsUsed,
                        done: true,
                    };

                    this.writeSSEData(response, finalResponse);
                }
            }

            response.end();
        } catch (error) {
            console.error('Streaming error:', error);

            const errorResponse: StreamingChatResponseDto = {
                chatId,
                messageId: '',
                content: '',
                delta: '',
                done: true,
                error: error.message || 'An error occurred during streaming',
            };

            this.writeSSEData(response, errorResponse);
            response.end();
        }
    }

    private writeSSEData(response: Response, data: StreamingChatResponseDto): void {
        const jsonData = JSON.stringify(data);
        response.write(`data: ${jsonData}\n\n`);
    }

    private estimateCredits(content: string, modelConfig: any): number {
        // Rough estimation: 1 token ≈ 4 characters for input + max output
        const estimatedInputTokens = Math.ceil(content.length / 4);
        const estimatedOutputTokens = 500; // Conservative estimate
        const totalEstimatedTokens = estimatedInputTokens + estimatedOutputTokens;

        return Math.ceil((totalEstimatedTokens / 1000) * modelConfig.costPerToken * 100) / 100;
    }

    async handleQuickResponse(
        chatId: string,
        userId: string,
        sendMessageDto: SendMessageDto,
    ): Promise<{
        userMessage: any;
        assistantMessage: any;
        creditsUsed: number;
    }> {
        const { content, model } = sendMessageDto;

        // Step 1: Save user message
        const userMessage = await this.messageService.addUserMessage(chatId, userId, content);

        // Step 2: Get conversation history
        const conversationHistory = await this.messageService.getConversationHistory(
            chatId,
            userId,
        );

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
            aiResponse.creditsUsed,
        );

        return {
            userMessage,
            assistantMessage,
            creditsUsed: aiResponse.creditsUsed,
        };
    }
}
