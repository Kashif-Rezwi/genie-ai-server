import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, MoreThan } from 'typeorm';
import { Chat, Message, MessageRole } from '../../../entities';
import {
  ConversationHistory,
  CostAnalysis,
  ModelUsage,
  RecentActivity,
} from '../interfaces/chat.interfaces';
import { MessageResponseDto } from '../dto/message.dto';

@Injectable()
export class MessageService {
  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(Chat)
    private readonly chatRepository: Repository<Chat>,
    private readonly dataSource: DataSource
  ) {}

  async addUserMessage(chatId: string, userId: string, content: string): Promise<Message> {
    // Verify chat belongs to user
    const chat = await this.chatRepository.findOne({
      where: { id: chatId, userId },
    });

    if (!chat) {
      throw new NotFoundException('Chat not found');
    }

    // Check for duplicate message in last 5 minutes
    const recentMessage = await this.messageRepository.findOne({
      where: {
        chatId,
        role: MessageRole.USER,
        content,
        createdAt: MoreThan(new Date(Date.now() - 5 * 60 * 1000)),
      },
    });

    if (recentMessage) {
      throw new BadRequestException(
        'Duplicate message detected. Please wait before sending the same message again.'
      );
    }

    const message = this.messageRepository.create({
      chatId,
      role: MessageRole.USER,
      content,
      creditsUsed: 0, // User messages don't cost credits
    });

    return this.messageRepository.save(message);
  }

  async addAssistantMessage(
    chatId: string,
    userId: string,
    content: string,
    model: string,
    creditsUsed: number
  ): Promise<Message> {
    // Verify chat belongs to user
    const chat = await this.chatRepository.findOne({
      where: { id: chatId, userId },
    });

    if (!chat) {
      throw new NotFoundException('Chat not found');
    }

    const message = this.messageRepository.create({
      chatId,
      role: MessageRole.ASSISTANT,
      content,
      model,
      creditsUsed,
    });

    return this.messageRepository.save(message);
  }

  async getChatMessages(
    chatId: string,
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ messages: MessageResponseDto[]; total: number }> {
    // Verify chat belongs to user
    const chat = await this.chatRepository.findOne({
      where: { id: chatId, userId },
    });

    if (!chat) {
      throw new NotFoundException('Chat not found');
    }

    const [messages, total] = await this.messageRepository.findAndCount({
      where: { chatId },
      order: { createdAt: 'ASC' },
      skip: offset,
      take: limit,
    });

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
    const chat = await this.chatRepository.findOne({
      where: { id: chatId, userId },
      relations: ['messages'],
    });

    if (!chat) {
      throw new NotFoundException('Chat not found');
    }

    // Convert messages to AI-SDK format
    return chat.messages
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map(msg => ({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content,
      }));
  }

  async deleteMessage(messageId: string, userId: string): Promise<void> {
    const message = await this.messageRepository.findOne({
      where: { id: messageId },
      relations: ['chat'],
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.chat.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    await this.messageRepository.remove(message);
  }

  async getMessageCostAnalysis(chatId: string, userId: string): Promise<CostAnalysis> {
    // Verify chat belongs to user
    const chat = await this.chatRepository.findOne({
      where: { id: chatId, userId },
    });

    if (!chat) {
      throw new NotFoundException('Chat not found');
    }

    const result = await this.messageRepository
      .createQueryBuilder('message')
      .select([
        "COALESCE(message.model, 'user') as model",
        'COUNT(*) as count',
        'SUM(message.creditsUsed) as totalCost',
      ])
      .where('message.chatId = :chatId', { chatId })
      .groupBy("COALESCE(message.model, 'user')")
      .getRawMany();

    const messagesByModel = result.map(row => ({
      model: row.model,
      count: parseInt(row.count),
      totalCost: parseFloat(row.totalCost) || 0,
    }));

    const totalCost = messagesByModel.reduce((sum, item) => sum + item.totalCost, 0);

    return {
      totalCost,
      messagesByModel,
    };
  }

  async getUserModelUsage(userId: string): Promise<ModelUsage[]> {
    const result = await this.messageRepository
      .createQueryBuilder('message')
      .innerJoin('message.chat', 'chat')
      .select([
        "COALESCE(message.model, 'user') as model",
        'COUNT(*) as messageCount',
        'SUM(message.creditsUsed) as totalCreditsUsed',
      ])
      .where('chat.userId = :userId', { userId })
      .andWhere('message.model IS NOT NULL')
      .groupBy('message.model')
      .orderBy('totalCreditsUsed', 'DESC')
      .getRawMany();

    return result.map(row => ({
      model: row.model,
      messageCount: parseInt(row.messageCount),
      totalCreditsUsed: parseFloat(row.totalCreditsUsed) || 0,
    }));
  }

  async getRecentActivity(userId: string, days: number = 7): Promise<RecentActivity[]> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    const result = await this.messageRepository
      .createQueryBuilder('message')
      .innerJoin('message.chat', 'chat')
      .select([
        'DATE(message.createdAt) as date',
        'COUNT(*) as messageCount',
        'SUM(message.creditsUsed) as creditsUsed',
      ])
      .where('chat.userId = :userId', { userId })
      .andWhere('message.createdAt >= :startDate', { startDate })
      .groupBy('DATE(message.createdAt)')
      .orderBy('date', 'ASC')
      .getRawMany();

    return result.map(row => ({
      date: row.date,
      messageCount: parseInt(row.messageCount),
      creditsUsed: parseFloat(row.creditsUsed) || 0,
    }));
  }
}
