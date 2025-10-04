import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    ValidationPipe,
    Res,
    HttpCode,
    HttpStatus,
    BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { ChatService } from './services/chat.service';
import { MessageService } from './services/message.service';
import { ChatStreamingService } from './services/chat-streaming.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RateLimit, RateLimitGuard } from '../security/guards/rate-limit.guard';
import { CreateChatDto, UpdateChatDto, SendMessageDto, ChatListQueryDto } from './dto/chat.dto';
import { RegenerateOptionsDto } from './dto/regenerate-options.dto';
import {
    AuthenticatedUser,
    ChatResponse,
    ChatDetailResponse,
    ChatAnalytics,
} from './interfaces/chat.interfaces';
import { UUIDValidationPipe } from '../../common/pipes/uuid-validation.pipe';

@Controller('chat')
@UseGuards(JwtAuthGuard, RateLimitGuard)
export class ChatController {
    constructor(
        private readonly chatService: ChatService,
        private readonly messageService: MessageService,
        private readonly streamingService: ChatStreamingService,
    ) {}

    @Post()
    @RateLimit('api')
    async createChat(
        @CurrentUser() user: AuthenticatedUser,
        @Body(ValidationPipe) createChatDto: CreateChatDto,
    ): Promise<ChatResponse> {
        const chat = await this.chatService.createChat(user.id, createChatDto);
        return {
            id: chat.id,
            title: chat.title,
            systemPrompt: chat.systemPrompt,
            messageCount: 0,
            createdAt: chat.createdAt,
            updatedAt: chat.updatedAt,
        };
    }

    @Get()
    async getUserChats(
        @CurrentUser() user: AuthenticatedUser,
        @Query(ValidationPipe) query: ChatListQueryDto,
    ) {
        return this.chatService.getUserChats(user.id, query);
    }

    @Get('stats')
    async getChatStats(@CurrentUser() user: AuthenticatedUser) {
        return this.chatService.getChatStats(user.id);
    }

    @Get(':chatId')
    async getChatById(
        @CurrentUser() user: AuthenticatedUser,
        @Param('chatId', UUIDValidationPipe) chatId: string,
    ): Promise<ChatDetailResponse> {
        return this.chatService.getChatById(chatId, user.id);
    }

    @Put(':chatId')
    async updateChat(
        @CurrentUser() user: AuthenticatedUser,
        @Param('chatId', UUIDValidationPipe) chatId: string,
        @Body(ValidationPipe) updateChatDto: UpdateChatDto,
    ): Promise<ChatResponse> {
        const chat = await this.chatService.updateChat(chatId, user.id, updateChatDto);
        return {
            id: chat.id,
            title: chat.title,
            systemPrompt: chat.systemPrompt,
            messageCount: 0, // Will be updated by the service
            createdAt: chat.createdAt,
            updatedAt: chat.updatedAt,
        };
    }

    @Delete(':chatId')
    @HttpCode(HttpStatus.NO_CONTENT)
    async deleteChat(
        @CurrentUser() user: AuthenticatedUser,
        @Param('chatId', UUIDValidationPipe) chatId: string,
    ): Promise<void> {
        await this.chatService.deleteChat(chatId, user.id);
    }

    @Get(':chatId/messages')
    async getChatMessages(
        @CurrentUser() user: AuthenticatedUser,
        @Param('chatId', UUIDValidationPipe) chatId: string,
        @Query('limit', ValidationPipe) limit: number = 50,
        @Query('offset', ValidationPipe) offset: number = 0,
    ) {
        return this.chatService.getChatMessagesPaginated(chatId, user.id, limit, offset);
    }

    @Get(':chatId/cost-analysis')
    async getChatCostAnalysis(
        @CurrentUser() user: AuthenticatedUser,
        @Param('chatId', UUIDValidationPipe) chatId: string,
    ) {
        return this.messageService.getMessageCostAnalysis(chatId, user.id);
    }

    @Post(':chatId/message')
    @RateLimit('ai_paid')
    async sendMessage(
        @CurrentUser() user: AuthenticatedUser,
        @Param('chatId', UUIDValidationPipe) chatId: string,
        @Body(ValidationPipe) sendMessageDto: SendMessageDto,
    ) {
        // Non-streaming quick response
        return this.streamingService.handleQuickResponse(chatId, user.id, sendMessageDto);
    }

    @Post(':chatId/stream')
    @RateLimit('ai_paid')
    async streamMessage(
        @CurrentUser() user: AuthenticatedUser,
        @Param('chatId', UUIDValidationPipe) chatId: string,
        @Body(ValidationPipe) sendMessageDto: SendMessageDto,
        @Res() response: Response,
    ): Promise<void> {
        // Set SSE headers
        response.setHeader('Content-Type', 'text/event-stream');
        response.setHeader('Cache-Control', 'no-cache');
        response.setHeader('Connection', 'keep-alive');
        response.setHeader('Access-Control-Allow-Origin', '*');
        response.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

        // Start streaming
        await this.streamingService.streamChatResponse(chatId, user.id, sendMessageDto, response);
    }

    @Delete(':chatId/messages/:messageId')
    @HttpCode(HttpStatus.NO_CONTENT)
    async deleteMessage(
        @CurrentUser() user: AuthenticatedUser,
        @Param('chatId', UUIDValidationPipe) chatId: string,
        @Param('messageId', UUIDValidationPipe) messageId: string,
    ): Promise<void> {
        await this.messageService.deleteMessage(messageId, user.id);
    }

    @Post('quick-start')
    async quickStartChat(
        @CurrentUser() user: AuthenticatedUser,
        @Body(ValidationPipe) sendMessageDto: SendMessageDto,
    ) {
        // Create a new chat with auto-generated title and send first message
        const title = await this.chatService.generateChatTitle(sendMessageDto.content);

        const createChatDto: CreateChatDto = {
            title,
            systemPrompt: sendMessageDto.systemPrompt,
            model: sendMessageDto.model,
        };

        const chat = await this.chatService.createChat(user.id, createChatDto);

        // Send the first message
        const result = await this.streamingService.handleQuickResponse(
            chat.id,
            user.id,
            sendMessageDto,
        );

        return {
            chat: {
                id: chat.id,
                title: chat.title,
                systemPrompt: chat.systemPrompt,
            },
            ...result,
        };
    }

    @Post(':chatId/regenerate')
    async regenerateLastResponse(
        @CurrentUser() user: AuthenticatedUser,
        @Param('chatId', UUIDValidationPipe) chatId: string,
        @Body(ValidationPipe) options: RegenerateOptionsDto,
    ) {
        // Get the last user message to regenerate response
        const { messages } = await this.messageService.getChatMessages(chatId, user.id, 2);
        const lastUserMessage = messages.reverse().find(m => m.role === 'user');

        if (!lastUserMessage) {
            throw new BadRequestException('No user message found to regenerate response');
        }

        const sendMessageDto: SendMessageDto = {
            content: lastUserMessage.content,
            model: options.model,
        };

        return this.streamingService.handleQuickResponse(chatId, user.id, sendMessageDto);
    }

    @Get('analytics/usage')
    async getChatAnalytics(@CurrentUser() user: AuthenticatedUser): Promise<ChatAnalytics> {
        const stats = await this.chatService.getChatStats(user.id);

        // Get model usage distribution
        const modelUsage = await this.messageService.getUserModelUsage(user.id);

        // Get recent activity
        const recentActivity = await this.messageService.getRecentActivity(user.id, 7);

        return {
            ...stats,
            modelUsage,
            recentActivity,
            averageCostPerMessage:
                stats.totalMessages > 0 ? stats.totalCreditsUsed / stats.totalMessages : 0,
        };
    }
}
