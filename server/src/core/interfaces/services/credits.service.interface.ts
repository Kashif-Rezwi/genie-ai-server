// Define CreditReservation interface locally to avoid circular dependencies
export interface CreditReservation {
  id: string;
  userId: string;
  amount: number;
  metadata?: Record<string, any>;
  createdAt: Date;
  expiresAt: Date;
}

/**
 * Interface for Credits Service
 * Defines the contract for credit management operations
 */
export interface ICreditsService {
  /**
   * Get user's current credit balance
   * @param userId - The user's ID
   * @returns Promise<number> - The user's credit balance
   */
  getBalance(userId: string): Promise<number>;

  /**
   * Add credits to user's account
   * @param userId - The user's ID
   * @param amount - The amount of credits to add
   * @param description - Description of the transaction
   * @param metadata - Optional metadata for the transaction
   * @returns Promise<void>
   */
  addCredits(
    userId: string,
    amount: number,
    description: string,
    metadata?: Record<string, any>
  ): Promise<void>;

  /**
   * Deduct credits from user's account
   * @param userId - The user's ID
   * @param amount - The amount of credits to deduct
   * @param description - Description of the transaction
   * @param metadata - Optional metadata for the transaction
   * @returns Promise<void>
   */
  deductCredits(
    userId: string,
    amount: number,
    description: string,
    metadata?: Record<string, any>
  ): Promise<void>;

  /**
   * Reserve credits for a pending operation
   * @param userId - The user's ID
   * @param amount - The amount of credits to reserve
   * @param metadata - Optional metadata for the reservation
   * @returns Promise<string> - The reservation ID
   */
  reserveCredits(
    userId: string,
    amount: number,
    metadata?: Record<string, any>
  ): Promise<string>;

  /**
   * Confirm a credit reservation
   * @param reservationId - The reservation ID
   * @returns Promise<void>
   */
  confirmReservation(reservationId: string): Promise<void>;

  /**
   * Release a credit reservation
   * @param reservationId - The reservation ID
   * @returns Promise<void>
   */
  releaseReservation(reservationId: string): Promise<void>;

  /**
   * Get user's recent credit transactions
   * @param userId - The user's ID
   * @param limit - Maximum number of transactions to return
   * @returns Promise<Array> - Array of recent transactions
   */
  getRecentTransactions(userId: string, limit?: number): Promise<any[]>;

  /**
   * Get credit transaction by ID
   * @param transactionId - The transaction ID
   * @returns Promise<CreditTransaction | null>
   */
  getTransactionById(transactionId: string): Promise<any | null>;
}
