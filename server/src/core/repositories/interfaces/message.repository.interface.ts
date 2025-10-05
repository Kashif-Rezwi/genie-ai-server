import { Message, MessageRole } from '../../../entities';

export interface IMessageRepository {
  /**
   * Find a message by ID
   */
  findById(id: string): Promise<Message | null>;

  /**
   * Find messages by chat ID
   */
  findByChatId(chatId: string, skip?: number, take?: number): Promise<Message[]>;

  /**
   * Find all messages with pagination
   */
  findAll(skip?: number, take?: number): Promise<Message[]>;

  /**
   * Create a new message
   */
  create(messageData: Partial<Message>): Promise<Message>;

  /**
   * Update a message
   */
  update(id: string, messageData: Partial<Message>): Promise<Message>;

  /**
   * Delete a message
   */
  delete(id: string): Promise<void>;

  /**
   * Find recent messages by chat
   */
  findRecentByChatId(chatId: string, limit?: number): Promise<Message[]>;

  /**
   * Find messages by role
   */
  findByRole(chatId: string, role: MessageRole): Promise<Message[]>;

  /**
   * Count messages by chat
   */
  countByChatId(chatId: string): Promise<number>;

  /**
   * Find messages with credits used above threshold
   */
  findByCreditsUsedAbove(threshold: number): Promise<Message[]>;

  /**
   * Get total credits used by chat
   */
  getTotalCreditsUsedByChat(chatId: string): Promise<number>;

  /**
   * Count messages by user (across all chats)
   */
  countByUserId(userId: string): Promise<number>;

  /**
   * Get total credits used by user (across all chats)
   */
  getTotalCreditsUsedByUserId(userId: string): Promise<number>;
}
