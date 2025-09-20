import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Chat, Message, MessageRole, User } from '../../../entities';
import { CreateChatDto, UpdateChatDto, ChatListQueryDto } from '../dto/chat.dto';
import { ChatResponseDto, ChatDetailResponseDto } from '../dto/message.dto';

@Injectable()
export class ChatService {
    constructor(
        @InjectRepository(Chat)
        private readonly chatRepository: Repository<Chat>,
        @InjectRepository(Message)
        private readonly messageRepository: Repository<Message>,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        private readonly dataSource: DataSource,
    ) { }

    async createChat(userId: string, createChatDto: CreateChatDto): Promise<Chat> {
        // Verify user exists
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user) {
            throw new NotFoundException('User not found');
        }

        const chat = this.chatRepository.create({
            title: createChatDto.title,
            systemPrompt: createChatDto.systemPrompt,
            userId,
        });

        const savedChat = await this.chatRepository.save(chat);

        // Add system message if system prompt is provided
        if (createChatDto.systemPrompt) {
            await this.messageRepository.save({
                chatId: savedChat.id,
                role: MessageRole.SYSTEM,
                content: createChatDto.systemPrompt,
                creditsUsed: 0,
            });
        }

        return savedChat;
    }

    async getUserChats(userId: string, query: ChatListQueryDto): Promise<{ chats: ChatResponseDto[]; total: number }> {
        const { limit = 20, offset = 0, search } = query;

        const queryBuilder = this.chatRepository
            .createQueryBuilder('chat')
            .leftJoin('chat.messages', 'message')
            .where('chat.userId = :userId', { userId })
            .select([
                'chat.id',
                'chat.title',
                'chat.systemPrompt',
                'chat.createdAt',
                'chat.updatedAt',
                'COUNT(message.id) as messageCount',
                'MAX(message.createdAt) as lastMessageAt'
            ])
            .groupBy('chat.id, chat.title, chat.systemPrompt, chat.createdAt, chat.updatedAt')
            .orderBy('COALESCE(MAX(message.createdAt), chat.createdAt)', 'DESC');

        if (search) {
            queryBuilder.andWhere('chat.title ILIKE :search', { search: `%${search}%` });
        }

        const [rawChats, total] = await Promise.all([
            queryBuilder.offset(offset).limit(limit).getRawMany(),
            queryBuilder.getCount(),
        ]);

        const chats: ChatResponseDto[] = rawChats.map(raw => ({
            id: raw.chat_id,
            title: raw.chat_title,
            systemPrompt: raw.chat_systemPrompt,
            messageCount: parseInt(raw.messageCount),
            lastMessageAt: raw.lastMessageAt ? new Date(raw.lastMessageAt) : undefined,
            createdAt: new Date(raw.chat_createdAt),
            updatedAt: new Date(raw.chat_updatedAt),
        }));

        return { chats, total };
    }

    async getChatById(chatId: string, userId: string): Promise<ChatDetailResponseDto> {
        const chat = await this.chatRepository.findOne({
            where: { id: chatId, userId },
            relations: ['messages'],
        });

        if (!chat) {
            throw new NotFoundException('Chat not found');
        }

        // Calculate total credits used in this chat
        const totalCreditsUsed = chat.messages.reduce((sum, msg) => sum + msg.creditsUsed, 0);

        // Sort messages by creation time
        const sortedMessages = chat.messages
            .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
            .map(msg => ({
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
        const chat = await this.chatRepository.findOne({
            where: { id: chatId, userId },
        });

        if (!chat) {
            throw new NotFoundException('Chat not found');
        }

        Object.assign(chat, updateChatDto);
        return this.chatRepository.save(chat);
    }

    async deleteChat(chatId: string, userId: string): Promise<void> {
        const chat = await this.chatRepository.findOne({
            where: { id: chatId, userId },
        });

        if (!chat) {
            throw new NotFoundException('Chat not found');
        }

        // Messages will be deleted automatically due to CASCADE delete
        await this.chatRepository.remove(chat);
    }

    async generateChatTitle(firstMessage: string): Promise<string> {
        // Generate a smart title from the first message
        const words = firstMessage.trim().split(' ').slice(0, 6);
        let title = words.join(' ');

        if (firstMessage.length > 50) {
            title += '...';
        }

        // Ensure title is not empty and has reasonable length
        if (!title || title.length < 3) {
            title = `Chat ${new Date().toLocaleDateString()}`;
        }

        return title.substring(0, 100);
    }

    async getChatStats(userId: string): Promise<{
        totalChats: number;
        totalMessages: number;
        totalCreditsUsed: number;
        averageMessagesPerChat: number;
    }> {
        const stats = await this.chatRepository
            .createQueryBuilder('chat')
            .leftJoin('chat.messages', 'message')
            .where('chat.userId = :userId', { userId })
            .select([
                'COUNT(DISTINCT chat.id) as totalChats',
                'COUNT(message.id) as totalMessages',
                'COALESCE(SUM(message.creditsUsed), 0) as totalCreditsUsed'
            ])
            .getRawOne();

        const totalChats = parseInt(stats.totalChats) || 0;
        const totalMessages = parseInt(stats.totalMessages) || 0;
        const totalCreditsUsed = parseFloat(stats.totalCreditsUsed) || 0;
        const averageMessagesPerChat = totalChats > 0 ? totalMessages / totalChats : 0;

        return {
            totalChats,
            totalMessages,
            totalCreditsUsed,
            averageMessagesPerChat,
        };
    }
}