// Define interfaces locally to avoid circular dependencies
export interface Chat {
  id: string;
  title: string;
  userId: string;
  systemPrompt?: string;
  createdAt: Date;
  updatedAt: Date;
  user?: any; // Use any to avoid circular dependency
  messages?: Message[];
}

export interface Message {
  id: string;
  content: string;
  role: string;
  chatId: string;
  creditsUsed?: number;
  createdAt: Date;
  updatedAt: Date;
  chat?: Chat;
}

// User interface is defined in auth.service.interface.ts to avoid conflicts

export interface CreateChatDto {
  title?: string;
  systemPrompt?: string;
}

export interface UpdateChatDto {
  title?: string;
  systemPrompt?: string;
}

export interface ChatListQueryDto {
  page?: number;
  limit?: number;
  search?: string;
}

export interface MessageResponse {
  id: string;
  content: string;
  role: string;
  creditsUsed: number;
  createdAt: Date;
}

export interface ChatDetailResponse {
  id: string;
  title: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  messages: MessageResponse[];
  messageCount: number;
}

export interface ChatResponse {
  data: Array<{
    id: string;
    title: string;
    createdAt: Date;
    updatedAt: Date;
    messageCount: number;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ChatStats {
  totalChats: number;
  totalMessages: number;
  averageMessagesPerChat: number;
  lastActivity?: Date;
}

/**
 * Interface for Chat Service
 * Defines the contract for chat management operations
 */
export interface IChatService {
  /**
   * Create a new chat
   * @param userId - The user's ID
   * @param createChatDto - Chat creation data
   * @returns Promise<Chat> - The created chat
   */
  createChat(userId: string, createChatDto: CreateChatDto): Promise<Chat>;

  /**
   * Get chat by ID
   * @param chatId - The chat ID
   * @param userId - The user's ID
   * @returns Promise<ChatDetailResponse> - Chat details
   */
  getChatById(chatId: string, userId: string): Promise<ChatDetailResponse>;

  /**
   * Get user's chats
   * @param userId - The user's ID
   * @param query - Query parameters
   * @returns Promise<ChatResponse> - List of chats
   */
  getUserChats(userId: string, query: ChatListQueryDto): Promise<ChatResponse>;

  /**
   * Update chat
   * @param chatId - The chat ID
   * @param userId - The user's ID
   * @param updateChatDto - Update data
   * @returns Promise<Chat> - Updated chat
   */
  updateChat(chatId: string, userId: string, updateChatDto: UpdateChatDto): Promise<Chat>;

  /**
   * Delete chat
   * @param chatId - The chat ID
   * @param userId - The user's ID
   * @returns Promise<void>
   */
  deleteChat(chatId: string, userId: string): Promise<void>;

  /**
   * Get chat statistics
   * @param userId - The user's ID
   * @returns Promise<ChatStats> - Chat statistics
   */
  getChatStats(userId: string): Promise<ChatStats>;

  /**
   * Check if user owns chat
   * @param chatId - The chat ID
   * @param userId - The user's ID
   * @returns Promise<boolean> - Whether user owns the chat
   */
  userOwnsChat(chatId: string, userId: string): Promise<boolean>;
}
