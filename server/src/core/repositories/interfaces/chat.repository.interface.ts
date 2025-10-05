import { Chat } from '../../../entities';

export interface IChatRepository {
  /**
   * Find a chat by ID
   */
  findById(id: string): Promise<Chat | null>;

  /**
   * Find chats by user ID
   */
  findByUserId(userId: string, skip?: number, take?: number): Promise<Chat[]>;

  /**
   * Find all chats with pagination
   */
  findAll(skip?: number, take?: number): Promise<Chat[]>;

  /**
   * Create a new chat
   */
  create(chatData: Partial<Chat>): Promise<Chat>;

  /**
   * Update a chat
   */
  update(id: string, chatData: Partial<Chat>): Promise<Chat>;

  /**
   * Delete a chat
   */
  delete(id: string): Promise<void>;

  /**
   * Find chat with messages
   */
  findByIdWithMessages(id: string): Promise<Chat | null>;

  /**
   * Find recent chats by user
   */
  findRecentByUserId(userId: string, limit?: number): Promise<Chat[]>;

  /**
   * Count chats by user
   */
  countByUserId(userId: string): Promise<number>;

  /**
   * Find chats by title search
   */
  findByTitleSearch(userId: string, searchTerm: string): Promise<Chat[]>;
}
