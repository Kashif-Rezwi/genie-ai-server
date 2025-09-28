import { MessageRole } from '../../../entities/message.entity';

export interface MessageResponseDto {
    id: string;
    role: MessageRole;
    content: string;
    model?: string;
    creditsUsed: number;
    createdAt: Date;
}

export interface ChatResponseDto {
    id: string;
    title: string;
    systemPrompt?: string;
    messageCount: number;
    lastMessageAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

export interface ChatDetailResponseDto {
    id: string;
    title: string;
    systemPrompt?: string;
    messages: MessageResponseDto[];
    totalCreditsUsed: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface StreamingChatResponseDto {
    chatId: string;
    messageId: string;
    content: string;
    delta: string;
    model?: string;
    creditsUsed?: number;
    done: boolean;
    error?: string;
}
