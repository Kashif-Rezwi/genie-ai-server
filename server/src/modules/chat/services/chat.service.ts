import {
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Chat, Message, MessageRole, User } from '../../../entities';
import { CreateChatDto, UpdateChatDto, ChatListQueryDto } from '../dto/chat.dto';
import { ChatResponse, ChatDetailResponse, ChatStats } from '../interfaces/chat.interfaces';
import { IChatRepository, IMessageRepository, IUserRepository } from '../../../core/repositories/interfaces';
import { ResourceNotFoundException, BusinessException } from '../../../common/exceptions';

@Injectable()
export class ChatService {
  constructor(
    private readonly chatRepository: IChatRepository,
    private readonly messageRepository: IMessageRepository,
    private readonly userRepository: IUserRepository,
    private readonly dataSource: DataSource
  ) {}

  async createChat(userId: string, createChatDto: CreateChatDto): Promise<Chat> {
    // Verify user exists
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new ResourceNotFoundException('User', 'USER_NOT_FOUND', { userId });
    }

    const savedChat = await this.chatRepository.create({
      title: createChatDto.title,
      systemPrompt: createChatDto.systemPrompt,
      userId,
    });

    // Add system message if system prompt is provided
    if (createChatDto.systemPrompt) {
      await this.messageRepository.create({
        chatId: savedChat.id,
        role: MessageRole.SYSTEM,
        content: createChatDto.systemPrompt,
        creditsUsed: 0,
      });
    }

    return savedChat;
  }

  async getUserChats(
    userId: string,
    query: ChatListQueryDto
  ): Promise<{ chats: ChatResponse[]; total: number }> {
    const { limit = 20, offset = 0, search } = query;

    let chats: Chat[];
    let total: number;

    if (search) {
      chats = await this.chatRepository.findByTitleSearch(userId, search);
      total = chats.length;
    } else {
      chats = await this.chatRepository.findByUserId(userId, offset, limit);
      total = await this.chatRepository.countByUserId(userId);
    }

    // Get message counts and last message times for each chat
    const chatsWithStats: ChatResponse[] = await Promise.all(
      chats.map(async (chat) => {
        const messageCount = await this.messageRepository.countByChatId(chat.id);
        const lastMessage = await this.messageRepository.findRecentByChatId(chat.id, 1);
        
        return {
          id: chat.id,
          title: chat.title,
          systemPrompt: chat.systemPrompt,
          messageCount,
          lastMessageAt: lastMessage[0]?.createdAt,
          createdAt: chat.createdAt,
          updatedAt: chat.updatedAt,
        };
      })
    );

    return { chats: chatsWithStats, total };
  }

  async getChatById(
    chatId: string,
    userId: string,
    limit: number = 50
  ): Promise<ChatDetailResponse> {
    // First, verify chat exists and belongs to user
    const chat = await this.chatRepository.findById(chatId);

    if (!chat || chat.userId !== userId) {
      throw new ResourceNotFoundException('Chat', 'CHAT_NOT_FOUND', { chatId });
    }

    // Get messages with pagination to avoid loading all messages
    const [messages, totalCreditsUsed] = await Promise.all([
      this.messageRepository.findByChatId(chatId, 0, limit),
      this.messageRepository.getTotalCreditsUsedByChat(chatId),
    ]);

    // Map messages to response format
    const sortedMessages = messages.map(msg => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      model: msg.model,
      creditsUsed: msg.creditsUsed,
      createdAt: msg.createdAt,
    }));

    return {
      id: chat.id,
      title: chat.title,
      systemPrompt: chat.systemPrompt,
      messages: sortedMessages,
      totalCreditsUsed,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
    };
  }

  async updateChat(chatId: string, userId: string, updateChatDto: UpdateChatDto): Promise<Chat> {
    const chat = await this.chatRepository.findById(chatId);

    if (!chat || chat.userId !== userId) {
      throw new ResourceNotFoundException('Chat', 'CHAT_NOT_FOUND', { chatId });
    }

    return this.chatRepository.update(chatId, updateChatDto);
  }

  async deleteChat(chatId: string, userId: string): Promise<void> {
    const chat = await this.chatRepository.findById(chatId);

    if (!chat || chat.userId !== userId) {
      throw new ResourceNotFoundException('Chat', 'CHAT_NOT_FOUND', { chatId });
    }

    // Messages will be deleted automatically due to CASCADE delete
    await this.chatRepository.delete(chatId);
  }

  async generateChatTitle(firstMessage: string): Promise<string> {
    try {
      // Use AI to generate a meaningful title
      const titlePrompt = `Generate a concise, descriptive title (max 6 words) for a chat that starts with this message: "${firstMessage.substring(0, 200)}"`;

      // For now, use a simple heuristic approach
      // In production, you would call the AI service here
      const words = firstMessage.trim().split(' ').slice(0, 6);
      let title = words.join(' ');

      // Clean up the title
      title = title.replace(/[^\w\s-]/g, '').trim();

      if (firstMessage.length > 50) {
        title += '...';
      }

      // Ensure title is not empty and has reasonable length
      if (!title || title.length < 3) {
        title = `Chat ${new Date().toLocaleDateString()}`;
      }

      return title.substring(0, 100);
    } catch (error) {
      // Fallback to simple title generation
      const words = firstMessage.trim().split(' ').slice(0, 6);
      let title = words.join(' ');

      if (firstMessage.length > 50) {
        title += '...';
      }

      if (!title || title.length < 3) {
        title = `Chat ${new Date().toLocaleDateString()}`;
      }

      return title.substring(0, 100);
    }
  }

  async getChatStats(userId: string): Promise<ChatStats> {
    const [totalChats, totalMessages, totalCreditsUsed] = await Promise.all([
      this.chatRepository.countByUserId(userId),
      this.messageRepository.countByUserId(userId),
      this.messageRepository.getTotalCreditsUsedByUserId(userId),
    ]);

    const averageMessagesPerChat = totalChats > 0 ? totalMessages / totalChats : 0;

    return {
      totalChats,
      totalMessages,
      totalCreditsUsed,
      averageMessagesPerChat,
    };
  }

  async getChatMessagesPaginated(
    chatId: string,
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ messages: any[]; total: number; hasMore: boolean }> {
    // Verify chat belongs to user
    const chat = await this.chatRepository.findById(chatId);

    if (!chat || chat.userId !== userId) {
      throw new ResourceNotFoundException('Chat', 'CHAT_NOT_FOUND', { chatId });
    }

    const [messages, total] = await Promise.all([
      this.messageRepository.findByChatId(chatId, offset, limit),
      this.messageRepository.countByChatId(chatId),
    ]);

    return {
      messages: messages.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        model: msg.model,
        creditsUsed: msg.creditsUsed,
        createdAt: msg.createdAt,
      })),
      total,
      hasMore: offset + limit < total,
    };
  }
}
