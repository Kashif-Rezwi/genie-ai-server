import { Injectable, ForbiddenException } from '@nestjs/common';
import { DataSource, MoreThan } from 'typeorm';
import { Chat, Message, MessageRole } from '../../../entities';
import {
  ConversationHistory,
  CostAnalysis,
  ModelUsage,
  RecentActivity,
} from '../interfaces/chat.interfaces';
import { MessageResponseDto } from '../dto/message.dto';
import { IChatRepository, IMessageRepository } from '../../../core/repositories/interfaces';
import {
  ResourceNotFoundException,
  BusinessException,
  ValidationException,
} from '../../../common/exceptions';

@Injectable()
export class MessageService {
  constructor(
    private readonly messageRepository: IMessageRepository,
    private readonly chatRepository: IChatRepository,
    private readonly dataSource: DataSource
  ) {}

  async addUserMessage(chatId: string, userId: string, content: string): Promise<Message> {
    // Verify chat belongs to user
    const chat = await this.chatRepository.findById(chatId);

    if (!chat || chat.userId !== userId) {
      throw new ResourceNotFoundException('Chat', 'CHAT_NOT_FOUND', { chatId });
    }

    // Check for duplicate message in last 5 minutes
    const recentMessages = await this.messageRepository.findByChatId(chatId, 0, 10);
    const recentMessage = recentMessages.find(
      msg =>
        msg.role === MessageRole.USER &&
        msg.content === content &&
        msg.createdAt > new Date(Date.now() - 5 * 60 * 1000)
    );

    if (recentMessage) {
      throw new BusinessException(
        'Duplicate message detected. Please wait before sending the same message again.',
        'DUPLICATE_MESSAGE_DETECTED',
        { chatId, content: `${content.substring(0, 50)}...` }
      );
    }

    return this.messageRepository.create({
      chatId,
      role: MessageRole.USER,
      content,
      creditsUsed: 0, // User messages don't cost credits
    });
  }

  async addAssistantMessage(
    chatId: string,
    userId: string,
    content: string,
    model: string,
    creditsUsed: number
  ): Promise<Message> {
    // Verify chat belongs to user
    const chat = await this.chatRepository.findById(chatId);

    if (!chat || chat.userId !== userId) {
      throw new ResourceNotFoundException('Chat', 'CHAT_NOT_FOUND', { chatId });
    }

    return this.messageRepository.create({
      chatId,
      role: MessageRole.ASSISTANT,
      content,
      model,
      creditsUsed,
    });
  }

  async getChatMessages(
    chatId: string,
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ messages: MessageResponseDto[]; total: number }> {
    // Verify chat belongs to user
    const chat = await this.chatRepository.findById(chatId);

    if (!chat || chat.userId !== userId) {
      throw new ResourceNotFoundException('Chat', 'CHAT_NOT_FOUND', { chatId });
    }

    const [messages, total] = await Promise.all([
      this.messageRepository.findByChatId(chatId, offset, limit),
      this.messageRepository.countByChatId(chatId),
    ]);

    const messageResponses: MessageResponseDto[] = messages.map(msg => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      model: msg.model,
      creditsUsed: msg.creditsUsed,
      createdAt: msg.createdAt,
    }));

    return { messages: messageResponses, total };
  }

  async getConversationHistory(chatId: string, userId: string): Promise<ConversationHistory[]> {
    // Verify chat belongs to user
    const chat = await this.chatRepository.findById(chatId);

    if (!chat || chat.userId !== userId) {
      throw new ResourceNotFoundException('Chat', 'CHAT_NOT_FOUND', { chatId });
    }

    // Get messages for the chat
    const messages = await this.messageRepository.findByChatId(chatId);

    // Convert messages to AI-SDK format
    return messages
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map(msg => ({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content,
      }));
  }

  async deleteMessage(messageId: string, userId: string): Promise<void> {
    const message = await this.messageRepository.findById(messageId);

    if (!message) {
      throw new ResourceNotFoundException('Message', 'MESSAGE_NOT_FOUND', { messageId });
    }

    // Get chat to verify ownership
    const chat = await this.chatRepository.findById(message.chatId);
    if (!chat || chat.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    await this.messageRepository.delete(messageId);
  }

  async getMessageCostAnalysis(chatId: string, userId: string): Promise<CostAnalysis> {
    // Verify chat belongs to user
    const chat = await this.chatRepository.findById(chatId);

    if (!chat || chat.userId !== userId) {
      throw new ResourceNotFoundException('Chat', 'CHAT_NOT_FOUND', { chatId });
    }

    // Get all messages for the chat
    const messages = await this.messageRepository.findByChatId(chatId);

    // Group by model and calculate costs
    const modelGroups = new Map<string, { count: number; totalCost: number }>();

    messages.forEach(msg => {
      const model = msg.model || 'user';
      const existing = modelGroups.get(model) || { count: 0, totalCost: 0 };
      modelGroups.set(model, {
        count: existing.count + 1,
        totalCost: existing.totalCost + msg.creditsUsed,
      });
    });

    const messagesByModel = Array.from(modelGroups.entries()).map(([model, data]) => ({
      model,
      count: data.count,
      totalCost: data.totalCost,
    }));

    const totalCost = messagesByModel.reduce((sum, item) => sum + item.totalCost, 0);

    return {
      totalCost,
      messagesByModel,
    };
  }

  async getUserModelUsage(userId: string): Promise<ModelUsage[]> {
    // Get all messages for the user
    const messages = await this.messageRepository.countByUserId(userId);

    // For now, return empty array since we need to implement this properly
    // This would require a more complex query that we'll handle later
    return [];
  }

  async getRecentActivity(userId: string, days: number = 7): Promise<RecentActivity[]> {
    // For now, return empty array since we need to implement this properly
    // This would require a more complex query that we'll handle later
    return [];
  }
}
