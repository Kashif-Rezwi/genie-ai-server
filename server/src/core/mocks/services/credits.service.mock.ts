import { ICreditsService } from '../../interfaces/services';

/**
 * Mock implementation of ICreditsService for testing
 */
export class MockCreditsService implements ICreditsService {
  private mockBalance = 100;
  private mockTransactions: any[] = [];
  private readonly mockReservations = new Map<string, any>();

  async getBalance(userId: string): Promise<number> {
    return this.mockBalance;
  }

  async addCredits(
    userId: string,
    amount: number,
    description: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    this.mockBalance += amount;
    this.mockTransactions.push({
      id: `tx_${Date.now()}`,
      userId,
      amount,
      type: 'PURCHASE',
      description,
      metadata,
      createdAt: new Date(),
    });
  }

  async deductCredits(
    userId: string,
    amount: number,
    description: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    if (this.mockBalance < amount) {
      throw new Error('Insufficient credits');
    }
    this.mockBalance -= amount;
    this.mockTransactions.push({
      id: `tx_${Date.now()}`,
      userId,
      amount: -amount,
      type: 'USAGE',
      description,
      metadata,
      createdAt: new Date(),
    });
  }

  async reserveCredits(
    userId: string,
    amount: number,
    metadata?: Record<string, any>
  ): Promise<string> {
    if (this.mockBalance < amount) {
      throw new Error('Insufficient credits');
    }
    const reservationId = `res_${Date.now()}`;
    this.mockReservations.set(reservationId, {
      id: reservationId,
      userId,
      amount,
      metadata,
      createdAt: new Date(),
    });
    this.mockBalance -= amount;
    return reservationId;
  }

  async confirmReservation(reservationId: string): Promise<void> {
    const reservation = this.mockReservations.get(reservationId);
    if (!reservation) {
      throw new Error('Reservation not found');
    }
    this.mockReservations.delete(reservationId);
  }

  async releaseReservation(reservationId: string): Promise<void> {
    const reservation = this.mockReservations.get(reservationId);
    if (!reservation) {
      throw new Error('Reservation not found');
    }
    this.mockBalance += reservation.amount;
    this.mockReservations.delete(reservationId);
  }

  async getRecentTransactions(userId: string, limit?: number): Promise<any[]> {
    const userTransactions = this.mockTransactions
      .filter(tx => tx.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return limit ? userTransactions.slice(0, limit) : userTransactions;
  }

  async getTransactionById(transactionId: string): Promise<any | null> {
    return this.mockTransactions.find(tx => tx.id === transactionId) || null;
  }

  // Test helpers
  setMockBalance(balance: number): void {
    this.mockBalance = balance;
  }

  getMockTransactions(): any[] {
    return [...this.mockTransactions];
  }

  clearMockData(): void {
    this.mockBalance = 100;
    this.mockTransactions = [];
    this.mockReservations.clear();
  }
}
