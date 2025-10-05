import { CreditTransaction, TransactionType } from '../../../entities';

export interface ICreditTransactionRepository {
  /**
   * Find a transaction by ID
   */
  findById(id: string): Promise<CreditTransaction | null>;

  /**
   * Find transactions by user ID
   */
  findByUserId(userId: string, skip?: number, take?: number): Promise<CreditTransaction[]>;

  /**
   * Find all transactions with pagination
   */
  findAll(skip?: number, take?: number): Promise<CreditTransaction[]>;

  /**
   * Create a new transaction
   */
  create(transactionData: Partial<CreditTransaction>): Promise<CreditTransaction>;

  /**
   * Update a transaction
   */
  update(id: string, transactionData: Partial<CreditTransaction>): Promise<CreditTransaction>;

  /**
   * Delete a transaction
   */
  delete(id: string): Promise<void>;

  /**
   * Find transactions by type
   */
  findByType(userId: string, type: TransactionType): Promise<CreditTransaction[]>;

  /**
   * Find transactions by date range
   */
  findByDateRange(userId: string, startDate: Date, endDate: Date): Promise<CreditTransaction[]>;

  /**
   * Count transactions by user
   */
  countByUserId(userId: string): Promise<number>;

  /**
   * Get total credits added for user
   */
  getTotalCreditsAdded(userId: string): Promise<number>;

  /**
   * Get total credits deducted for user
   */
  getTotalCreditsDeducted(userId: string): Promise<number>;

  /**
   * Find recent transactions
   */
  findRecentByUserId(userId: string, limit?: number): Promise<CreditTransaction[]>;

  /**
   * Find transactions with conditions
   */
  find(conditions: any): Promise<CreditTransaction[]>;

  /**
   * Find one transaction with conditions
   */
  findOne(conditions: any): Promise<CreditTransaction | null>;

  /**
   * Count transactions
   */
  count(): Promise<number>;
}
