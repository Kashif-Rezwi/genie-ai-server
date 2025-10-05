import { 
  IChatService, 
  Chat, 
  Message, 
  CreateChatDto, 
  UpdateChatDto, 
  ChatListQueryDto,
  ChatResponse,
  ChatDetailResponse,
  ChatStats,
  MessageResponse
} from '../../interfaces/services';

/**
 * Mock implementation of IChatService for testing
 */
export class MockChatService implements IChatService {
  private mockChats: Chat[] = [];
  private mockMessages: Message[] = [];
  private nextId = 1;

  async createChat(userId: string, createChatDto: CreateChatDto): Promise<Chat> {
    const chat: Chat = {
      id: `chat_${this.nextId++}`,
      title: createChatDto.title || 'New Chat',
      userId,
      systemPrompt: createChatDto.systemPrompt,
      createdAt: new Date(),
      updatedAt: new Date(),
      messages: [],
    };
    this.mockChats.push(chat);
    return chat;
  }

  async getChatById(chatId: string, userId: string): Promise<ChatDetailResponse> {
    const chat = this.mockChats.find(c => c.id === chatId && c.userId === userId);
    if (!chat) {
      throw new Error('Chat not found');
    }
    
    const messages = this.mockMessages.filter(m => m.chatId === chatId);
    return {
      id: chat.id,
      title: chat.title,
      userId: chat.userId,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
      messages: messages.map(m => ({
        id: m.id,
        content: m.content,
        role: m.role,
        creditsUsed: m.creditsUsed || 0,
        createdAt: m.createdAt,
      })),
      messageCount: messages.length,
    };
  }

  async getUserChats(userId: string, query: ChatListQueryDto): Promise<ChatResponse> {
    const userChats = this.mockChats
      .filter(c => c.userId === userId)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    const start = query.page ? (query.page - 1) * (query.limit || 10) : 0;
    const end = start + (query.limit || 10);
    const paginatedChats = userChats.slice(start, end);

    return {
      data: paginatedChats.map(chat => ({
        id: chat.id,
        title: chat.title,
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt,
        messageCount: this.mockMessages.filter(m => m.chatId === chat.id).length,
      })),
      pagination: {
        page: query.page || 1,
        limit: query.limit || 10,
        total: userChats.length,
        totalPages: Math.ceil(userChats.length / (query.limit || 10)),
      },
    };
  }

  async updateChat(chatId: string, userId: string, updateChatDto: UpdateChatDto): Promise<Chat> {
    const chat = this.mockChats.find(c => c.id === chatId && c.userId === userId);
    if (!chat) {
      throw new Error('Chat not found');
    }

    if (updateChatDto.title) {
      chat.title = updateChatDto.title;
    }
    chat.updatedAt = new Date();

    return chat;
  }

  async deleteChat(chatId: string, userId: string): Promise<void> {
    const chatIndex = this.mockChats.findIndex(c => c.id === chatId && c.userId === userId);
    if (chatIndex === -1) {
      throw new Error('Chat not found');
    }

    this.mockChats.splice(chatIndex, 1);
    // Also remove associated messages
    this.mockMessages = this.mockMessages.filter(m => m.chatId !== chatId);
  }

  async getChatStats(userId: string): Promise<ChatStats> {
    const userChats = this.mockChats.filter(c => c.userId === userId);
    const userMessages = this.mockMessages.filter(m => 
      userChats.some(c => c.id === m.chatId)
    );

    return {
      totalChats: userChats.length,
      totalMessages: userMessages.length,
      averageMessagesPerChat: userChats.length > 0 ? userMessages.length / userChats.length : 0,
    };
  }

  async userOwnsChat(chatId: string, userId: string): Promise<boolean> {
    return this.mockChats.some(c => c.id === chatId && c.userId === userId);
  }

  // Test helpers
  addMockChat(chat: Chat): void {
    this.mockChats.push(chat);
  }

  addMockMessage(message: Message): void {
    this.mockMessages.push(message);
  }

  getMockChats(): Chat[] {
    return [...this.mockChats];
  }

  getMockMessages(): Message[] {
    return [...this.mockMessages];
  }

  clearMockData(): void {
    this.mockChats = [];
    this.mockMessages = [];
    this.nextId = 1;
  }
}
