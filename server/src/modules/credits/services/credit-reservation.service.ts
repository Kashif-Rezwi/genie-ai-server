import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { creditConfig } from '../../../config';

export interface CreditReservation {
  id: string;
  userId: string;
  amount: number;
  status: 'pending' | 'confirmed' | 'released';
  expiresAt: Date;
  metadata?: Record<string, any>;
}

/**
 * Service responsible for managing credit reservations
 * Handles temporary credit holds for pending operations
 */
@Injectable()
export class CreditReservationService {
  private readonly logger = new Logger(CreditReservationService.name);
  private readonly config = creditConfig();

  constructor(@InjectRedis() private readonly redis: Redis) {}

  /**
   * Create a new credit reservation
   * @param userId - The user's ID
   * @param amount - The amount of credits to reserve
   * @param ttlSeconds - Time to live in seconds (default: 300)
   * @param metadata - Optional metadata for the reservation
   * @returns Promise<CreditReservation> - The created reservation
   */
  async createReservation(
    userId: string,
    amount: number,
    ttlSeconds: number = 300,
    metadata?: Record<string, any>
  ): Promise<CreditReservation> {
    if (!userId || typeof userId !== 'string') {
      throw new BadRequestException('Invalid user ID');
    }

    if (typeof amount !== 'number' || amount <= 0) {
      throw new BadRequestException('Invalid reservation amount');
    }

    const reservationId = uuidv4();
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    const reservation: CreditReservation = {
      id: reservationId,
      userId,
      amount,
      status: 'pending',
      expiresAt,
      metadata,
    };

    const key = `reservation:${reservationId}`;
    await this.redis.setex(key, ttlSeconds, JSON.stringify(reservation));

    this.logger.debug(`Created reservation ${reservationId} for user ${userId}: ${amount} credits`);

    return reservation;
  }

  /**
   * Get a reservation by ID
   * @param reservationId - The reservation ID
   * @returns Promise<CreditReservation | null> - The reservation or null if not found
   */
  async getReservation(reservationId: string): Promise<CreditReservation | null> {
    if (!reservationId || typeof reservationId !== 'string') {
      throw new BadRequestException('Invalid reservation ID');
    }

    const key = `reservation:${reservationId}`;
    const data = await this.redis.get(key);

    if (!data) {
      return null;
    }

    try {
      const reservation = JSON.parse(data) as CreditReservation;
      reservation.expiresAt = new Date(reservation.expiresAt);
      return reservation;
    } catch (error) {
      this.logger.error(`Failed to parse reservation data for ${reservationId}:`, error);
      return null;
    }
  }

  /**
   * Confirm a reservation (mark as confirmed)
   * @param reservationId - The reservation ID
   * @returns Promise<boolean> - True if confirmed, false if not found
   */
  async confirmReservation(reservationId: string): Promise<boolean> {
    const reservation = await this.getReservation(reservationId);
    if (!reservation) {
      return false;
    }

    if (reservation.status !== 'pending') {
      this.logger.warn(
        `Reservation ${reservationId} is not pending (status: ${reservation.status})`
      );
      return false;
    }

    reservation.status = 'confirmed';
    const key = `reservation:${reservationId}`;
    const ttl = await this.redis.ttl(key);

    if (ttl > 0) {
      await this.redis.setex(key, ttl, JSON.stringify(reservation));
      this.logger.debug(`Confirmed reservation ${reservationId}`);
      return true;
    }

    return false;
  }

  /**
   * Release a reservation (mark as released)
   * @param reservationId - The reservation ID
   * @returns Promise<boolean> - True if released, false if not found
   */
  async releaseReservation(reservationId: string): Promise<boolean> {
    const reservation = await this.getReservation(reservationId);
    if (!reservation) {
      return false;
    }

    if (reservation.status === 'released') {
      this.logger.warn(`Reservation ${reservationId} is already released`);
      return true;
    }

    reservation.status = 'released';
    const key = `reservation:${reservationId}`;
    const ttl = await this.redis.ttl(key);

    if (ttl > 0) {
      await this.redis.setex(key, ttl, JSON.stringify(reservation));
      this.logger.debug(`Released reservation ${reservationId}`);
      return true;
    }

    return false;
  }

  /**
   * Delete a reservation
   * @param reservationId - The reservation ID
   * @returns Promise<boolean> - True if deleted, false if not found
   */
  async deleteReservation(reservationId: string): Promise<boolean> {
    if (!reservationId || typeof reservationId !== 'string') {
      throw new BadRequestException('Invalid reservation ID');
    }

    const key = `reservation:${reservationId}`;
    const result = await this.redis.del(key);

    if (result > 0) {
      this.logger.debug(`Deleted reservation ${reservationId}`);
      return true;
    }

    return false;
  }

  /**
   * Get all active reservations for a user
   * @param userId - The user's ID
   * @returns Promise<CreditReservation[]> - Array of active reservations
   */
  async getUserReservations(userId: string): Promise<CreditReservation[]> {
    if (!userId || typeof userId !== 'string') {
      throw new BadRequestException('Invalid user ID');
    }

    const pattern = 'reservation:*';
    const keys = await this.redis.keys(pattern);
    const reservations: CreditReservation[] = [];

    for (const key of keys) {
      const data = await this.redis.get(key);
      if (data) {
        try {
          const reservation = JSON.parse(data) as CreditReservation;
          if (reservation.userId === userId && reservation.status !== 'released') {
            reservation.expiresAt = new Date(reservation.expiresAt);
            reservations.push(reservation);
          }
        } catch (error) {
          this.logger.warn(`Failed to parse reservation data for key ${key}:`, error);
        }
      }
    }

    return reservations.sort((a, b) => b.expiresAt.getTime() - a.expiresAt.getTime());
  }

  /**
   * Clean up expired reservations
   * @returns Promise<number> - Number of cleaned up reservations
   */
  async cleanupExpiredReservations(): Promise<number> {
    const pattern = 'reservation:*';
    const keys = await this.redis.keys(pattern);
    let cleanedCount = 0;

    for (const key of keys) {
      const data = await this.redis.get(key);
      if (data) {
        try {
          const reservation = JSON.parse(data) as CreditReservation;
          const now = new Date();
          const expiresAt = new Date(reservation.expiresAt);

          if (now > expiresAt) {
            await this.redis.del(key);
            cleanedCount++;
            this.logger.debug(`Cleaned up expired reservation ${reservation.id}`);
          }
        } catch (error) {
          this.logger.warn(`Failed to parse reservation data for cleanup ${key}:`, error);
        }
      }
    }

    if (cleanedCount > 0) {
      this.logger.log(`Cleaned up ${cleanedCount} expired reservations`);
    }

    return cleanedCount;
  }

  /**
   * Get total reserved credits for a user
   * @param userId - The user's ID
   * @returns Promise<number> - Total reserved credits
   */
  async getTotalReservedCredits(userId: string): Promise<number> {
    const reservations = await this.getUserReservations(userId);
    return reservations.reduce((total, reservation) => {
      if (reservation.status === 'pending' || reservation.status === 'confirmed') {
        return total + reservation.amount;
      }
      return total;
    }, 0);
  }
}
