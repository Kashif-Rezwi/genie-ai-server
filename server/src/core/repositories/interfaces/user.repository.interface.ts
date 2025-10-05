import { User } from '../../../entities';

export interface IUserRepository {
  /**
   * Find a user by ID
   */
  findById(id: string): Promise<User | null>;

  /**
   * Find a user by email
   */
  findByEmail(email: string): Promise<User | null>;

  /**
   * Find all users with pagination
   */
  findAll(skip?: number, take?: number): Promise<User[]>;

  /**
   * Create a new user
   */
  create(userData: Partial<User>): Promise<User>;

  /**
   * Update a user
   */
  update(id: string, userData: Partial<User>): Promise<User>;

  /**
   * Delete a user
   */
  delete(id: string): Promise<void>;

  /**
   * Check if user exists by email
   */
  existsByEmail(email: string): Promise<boolean>;

  /**
   * Update user credits balance
   */
  updateCreditsBalance(id: string, amount: number): Promise<void>;

  /**
   * Update user reserved credits
   */
  updateReservedCredits(id: string, amount: number): Promise<void>;

  /**
   * Find users by role
   */
  findByRole(role: string): Promise<User[]>;

  /**
   * Count total users
   */
  count(): Promise<number>;

  /**
   * Find active users
   */
  findActiveUsers(): Promise<User[]>;
}
