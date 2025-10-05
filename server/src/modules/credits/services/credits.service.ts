import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CreditBalanceService } from './credit-balance.service';
import { CreditTransactionService } from './credit-transaction.service';
import { CreditReservationService, CreditReservation } from './credit-reservation.service';
/**
 * Main credits service that orchestrates credit operations
 * This is a refactored version that delegates to specialized services
 */
@Injectable()
export class CreditsService {
  private readonly logger = new Logger(CreditsService.name);

  constructor(
    private readonly balanceService: CreditBalanceService,
    private readonly transactionService: CreditTransactionService,
    private readonly reservationService: CreditReservationService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Get user's current credit balance
   * @param userId - The user's ID
   * @returns Promise<number> - The user's credit balance
   */
  async getBalance(userId: string): Promise<number> {
    return this.balanceService.getBalance(userId);
  }

  /**
   * Add credits to a user's account
   * @param userId - The user's ID
   * @param amount - The amount of credits to add
   * @param description - Description of the transaction
   * @param metadata - Optional metadata for the transaction
   * @returns Promise<void>
   */
  async addCredits(
    userId: string,
    amount: number,
    description: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    await this.transactionService.addCredits(userId, amount, description, metadata);
  }

  /**
   * Deduct credits from a user's account
   * @param userId - The user's ID
   * @param amount - The amount of credits to deduct
   * @param description - Description of the transaction
   * @param metadata - Optional metadata for the transaction
   * @returns Promise<void>
   */
  async deductCredits(
    userId: string,
    amount: number,
    description: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    await this.transactionService.deductCredits(userId, amount, description, metadata);
  }

  /**
   * Get user's credit status including balance, reserved, and available credits
   * @param userId - The user's ID
   * @returns Promise<object> - User's credit status
   */
  async getUserCreditStatus(userId: string): Promise<{
    balance: number;
    reserved: number;
    available: number;
    status: 'healthy' | 'low' | 'critical' | 'exhausted';
    canUsePaidModels: boolean;
  }> {
    return this.balanceService.getUserCreditStatus(userId);
  }

  /**
   * Get transaction history for a user
   * @param userId - The user's ID
   * @param limit - Maximum number of transactions to return
   * @param offset - Number of transactions to skip
   * @returns Promise<CreditTransaction[]> - Array of transactions
   */
  async getTransactionHistory(userId: string, limit: number = 50, offset: number = 0) {
    return this.transactionService.getTransactionHistory(userId, limit, offset);
  }

  /**
   * Create a credit reservation
   * @param userId - The user's ID
   * @param amount - The amount of credits to reserve
   * @param ttlSeconds - Time to live in seconds
   * @param metadata - Optional metadata for the reservation
   * @returns Promise<CreditReservation> - The created reservation
   */
  async createReservation(
    userId: string,
    amount: number,
    ttlSeconds: number = 300,
    metadata?: Record<string, any>,
  ): Promise<CreditReservation> {
    return this.reservationService.createReservation(userId, amount, ttlSeconds, metadata);
  }

  /**
   * Confirm a credit reservation
   * @param reservationId - The reservation ID
   * @returns Promise<boolean> - True if confirmed, false if not found
   */
  async confirmReservation(reservationId: string): Promise<boolean> {
    return this.reservationService.confirmReservation(reservationId);
  }

  /**
   * Release a credit reservation
   * @param reservationId - The reservation ID
   * @returns Promise<boolean> - True if released, false if not found
   */
  async releaseReservation(reservationId: string): Promise<boolean> {
    return this.reservationService.releaseReservation(reservationId);
  }

  /**
   * Get all active reservations for a user
   * @param userId - The user's ID
   * @returns Promise<CreditReservation[]> - Array of active reservations
   */
  async getUserReservations(userId: string): Promise<CreditReservation[]> {
    return this.reservationService.getUserReservations(userId);
  }

  /**
   * Clean up expired reservations
   * @returns Promise<number> - Number of cleaned up reservations
   */
  async cleanupExpiredReservations(): Promise<number> {
    return this.reservationService.cleanupExpiredReservations();
  }

  /**
   * Get total reserved credits for a user
   * @param userId - The user's ID
   * @returns Promise<number> - Total reserved credits
   */
  async getTotalReservedCredits(userId: string): Promise<number> {
    return this.reservationService.getTotalReservedCredits(userId);
  }

  /**
   * Get recent transactions for a user (compatibility method)
   * @param userId - The user's ID
   * @param limit - Maximum number of transactions to return
   * @returns Promise<CreditTransaction[]> - Array of recent transactions
   */
  async getRecentTransactions(userId: string, limit: number = 10) {
    return this.transactionService.getTransactionHistory(userId, limit, 0);
  }

  /**
   * Reserve credits for a user (compatibility method)
   * @param userId - The user's ID
   * @param amount - The amount of credits to reserve
   * @param metadata - Optional metadata for the reservation
   * @returns Promise<string> - The reservation ID
   */
  async reserveCredits(
    userId: string,
    amount: number,
    metadata?: Record<string, any>,
  ): Promise<string> {
    const reservation = await this.reservationService.createReservation(
      userId,
      amount,
      300, // 5 minutes default
      metadata,
    );
    return reservation.id;
  }

  /**
   * Add credits with idempotency (compatibility method)
   * @param userId - The user's ID
   * @param amount - The amount of credits to add
   * @param description - Description of the transaction
   * @param metadata - Optional metadata for the transaction
   * @returns Promise<void>
   */
  async addCreditsIdempotent(
    userId: string,
    amount: number,
    description: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    // For MVP, just call regular addCredits
    // In production, you'd implement proper idempotency logic
    await this.addCredits(userId, amount, description, metadata);
  }
}