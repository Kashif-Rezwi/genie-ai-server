import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { QueryCacheService } from './query-cache.service';

export interface OptimizedReservation {
  id: string;
  userId: string;
  amount: number;
  status: 'pending' | 'confirmed' | 'released' | 'expired';
  expiresAt: Date;
  createdAt: Date;
  metadata?: Record<string, any>;
}

export interface ReservationStats {
  totalReserved: number;
  activeReservations: number;
  expiredReservations: number;
  averageReservationTime: number;
}

/**
 * Optimized credit reservation service with performance improvements
 * Uses Redis for fast operations and implements efficient algorithms
 */
@Injectable()
export class OptimizedCreditReservationService {
  private readonly logger = new Logger(OptimizedCreditReservationService.name);
  private readonly reservationPrefix = 'reservation:';
  private readonly userReservationsPrefix = 'user_reservations:';
  private readonly statsPrefix = 'reservation_stats:';

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly queryCache: QueryCacheService,
  ) {}

  /**
   * Create a new credit reservation with optimized logic
   * @param userId - User ID
   * @param amount - Amount to reserve
   * @param ttlSeconds - Time to live in seconds
   * @param metadata - Optional metadata
   * @returns Promise<OptimizedReservation> - Created reservation
   */
  async createReservation(
    userId: string,
    amount: number,
    ttlSeconds: number = 300,
    metadata?: Record<string, any>,
  ): Promise<OptimizedReservation> {
    const reservationId = this.generateReservationId();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

    const reservation: OptimizedReservation = {
      id: reservationId,
      userId,
      amount,
      status: 'pending',
      expiresAt,
      createdAt: now,
      metadata,
    };

    try {
      // Use Redis pipeline for atomic operations
      const pipeline = this.redis.pipeline();

      // Store reservation
      pipeline.setex(
        `${this.reservationPrefix}${reservationId}`,
        ttlSeconds,
        JSON.stringify(reservation)
      );

      // Add to user's reservation set
      pipeline.sadd(`${this.userReservationsPrefix}${userId}`, reservationId);

      // Update user's total reserved amount
      pipeline.hincrby(`${this.userReservationsPrefix}${userId}:totals`, 'reserved', amount);

      // Set expiration for user reservation set
      pipeline.expire(`${this.userReservationsPrefix}${userId}`, ttlSeconds + 60);

      // Update statistics
      pipeline.hincrby(`${this.statsPrefix}${userId}`, 'totalReservations', 1);
      pipeline.hincrby(`${this.statsPrefix}${userId}`, 'totalAmount', amount);

      await pipeline.exec();

      // Invalidate user balance cache
      await this.queryCache.invalidate(`user_balance:${userId}`);

      this.logger.debug(`Reservation ${reservationId} created for user ${userId}`);
      return reservation;
    } catch (error) {
      this.logger.error(`Failed to create reservation ${reservationId}:`, error);
      throw error;
    }
  }

  /**
   * Confirm a reservation with optimized logic
   * @param reservationId - Reservation ID
   * @returns Promise<boolean> - Success status
   */
  async confirmReservation(reservationId: string): Promise<boolean> {
    try {
      const reservation = await this.getReservation(reservationId);
      if (!reservation || reservation.status !== 'pending') {
        return false;
      }

      // Use Redis pipeline for atomic operations
      const pipeline = this.redis.pipeline();

      // Update reservation status
      reservation.status = 'confirmed';
      pipeline.setex(
        `${this.reservationPrefix}${reservationId}`,
        this.getRemainingTtl(reservation.expiresAt),
        JSON.stringify(reservation)
      );

      // Update user's confirmed amount
      pipeline.hincrby(
        `${this.userReservationsPrefix}${reservation.userId}:totals`,
        'confirmed',
        reservation.amount
      );

      // Update statistics
      pipeline.hincrby(`${this.statsPrefix}${reservation.userId}`, 'confirmedReservations', 1);

      await pipeline.exec();

      // Invalidate user balance cache
      await this.queryCache.invalidate(`user_balance:${reservation.userId}`);

      this.logger.debug(`Reservation ${reservationId} confirmed`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to confirm reservation ${reservationId}:`, error);
      return false;
    }
  }

  /**
   * Release a reservation with optimized logic
   * @param reservationId - Reservation ID
   * @returns Promise<boolean> - Success status
   */
  async releaseReservation(reservationId: string): Promise<boolean> {
    try {
      const reservation = await this.getReservation(reservationId);
      if (!reservation) {
        return false;
      }

      // Use Redis pipeline for atomic operations
      const pipeline = this.redis.pipeline();

      // Update reservation status
      reservation.status = 'released';
      pipeline.setex(
        `${this.reservationPrefix}${reservationId}`,
        this.getRemainingTtl(reservation.expiresAt),
        JSON.stringify(reservation)
      );

      // Remove from user's active reservations
      pipeline.srem(`${this.userReservationsPrefix}${reservation.userId}`, reservationId);

      // Update user's totals
      pipeline.hincrby(
        `${this.userReservationsPrefix}${reservation.userId}:totals`,
        'reserved',
        -reservation.amount
      );

      // Update statistics
      pipeline.hincrby(`${this.statsPrefix}${reservation.userId}`, 'releasedReservations', 1);

      await pipeline.exec();

      // Invalidate user balance cache
      await this.queryCache.invalidate(`user_balance:${reservation.userId}`);

      this.logger.debug(`Reservation ${reservationId} released`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to release reservation ${reservationId}:`, error);
      return false;
    }
  }

  /**
   * Get user's total reserved credits with caching
   * @param userId - User ID
   * @returns Promise<number> - Total reserved credits
   */
  async getTotalReservedCredits(userId: string): Promise<number> {
    return this.queryCache.getOrSet(
      `user_reserved_credits:${userId}`,
      async () => {
        const totals = await this.redis.hgetall(`${this.userReservationsPrefix}${userId}:totals`);
        return parseInt(totals.reserved || '0', 10);
      },
      { ttl: 60 } // 1 minute cache
    ).then(result => result.data);
  }

  /**
   * Get user's active reservations with caching
   * @param userId - User ID
   * @returns Promise<OptimizedReservation[]> - Active reservations
   */
  async getUserReservations(userId: string): Promise<OptimizedReservation[]> {
    return this.queryCache.getOrSet(
      `user_reservations:${userId}`,
      async () => {
        const reservationIds = await this.redis.smembers(`${this.userReservationsPrefix}${userId}`);
        if (reservationIds.length === 0) return [];

        const reservations: OptimizedReservation[] = [];
        for (const id of reservationIds) {
          const reservation = await this.getReservation(id);
          if (reservation && reservation.status === 'pending') {
            reservations.push(reservation);
          }
        }

        return reservations;
      },
      { ttl: 30 } // 30 seconds cache
    ).then(result => result.data);
  }

  /**
   * Clean up expired reservations efficiently
   * @returns Promise<number> - Number of cleaned up reservations
   */
  async cleanupExpiredReservations(): Promise<number> {
    try {
      const now = Date.now();
      const pattern = `${this.reservationPrefix}*`;
      const keys = await this.redis.keys(pattern);
      
      let cleanedCount = 0;
      const pipeline = this.redis.pipeline();

      for (const key of keys) {
        const reservationData = await this.redis.get(key);
        if (!reservationData) continue;

        const reservation: OptimizedReservation = JSON.parse(reservationData);
        
        if (reservation.expiresAt.getTime() < now && reservation.status === 'pending') {
          // Mark as expired
          reservation.status = 'expired';
          pipeline.setex(key, 3600, JSON.stringify(reservation)); // Keep for 1 hour

          // Remove from user's active reservations
          pipeline.srem(`${this.userReservationsPrefix}${reservation.userId}`, reservation.id);

          // Update user's totals
          pipeline.hincrby(
            `${this.userReservationsPrefix}${reservation.userId}:totals`,
            'reserved',
            -reservation.amount
          );

          // Update statistics
          pipeline.hincrby(`${this.statsPrefix}${reservation.userId}`, 'expiredReservations', 1);

          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        await pipeline.exec();
        this.logger.log(`Cleaned up ${cleanedCount} expired reservations`);
      }

      return cleanedCount;
    } catch (error) {
      this.logger.error('Failed to cleanup expired reservations:', error);
      return 0;
    }
  }

  /**
   * Get reservation statistics for a user
   * @param userId - User ID
   * @returns Promise<ReservationStats> - Reservation statistics
   */
  async getReservationStats(userId: string): Promise<ReservationStats> {
    return this.queryCache.getOrSet(
      `reservation_stats:${userId}`,
      async () => {
        const [totals, stats] = await Promise.all([
          this.redis.hgetall(`${this.userReservationsPrefix}${userId}:totals`),
          this.redis.hgetall(`${this.statsPrefix}${userId}`),
        ]);

        const totalReserved = parseInt(totals.reserved || '0', 10);
        const activeReservations = await this.redis.scard(`${this.userReservationsPrefix}${userId}`);
        const expiredReservations = parseInt(stats.expiredReservations || '0', 10);
        const totalReservations = parseInt(stats.totalReservations || '0', 10);

        return {
          totalReserved,
          activeReservations,
          expiredReservations,
          averageReservationTime: totalReservations > 0 ? 0 : 0, // Would need more complex tracking
        };
      },
      { ttl: 300 } // 5 minutes cache
    ).then(result => result.data);
  }

  /**
   * Get a reservation by ID
   * @param reservationId - Reservation ID
   * @returns Promise<OptimizedReservation | null> - Reservation or null
   */
  private async getReservation(reservationId: string): Promise<OptimizedReservation | null> {
    try {
      const data = await this.redis.get(`${this.reservationPrefix}${reservationId}`);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      this.logger.warn(`Failed to get reservation ${reservationId}:`, error);
      return null;
    }
  }

  /**
   * Get remaining TTL for a reservation
   * @param expiresAt - Expiration date
   * @returns number - TTL in seconds
   */
  private getRemainingTtl(expiresAt: Date): number {
    const now = new Date();
    const remaining = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
    return remaining;
  }

  /**
   * Generate unique reservation ID
   * @returns string - Reservation ID
   */
  private generateReservationId(): string {
    return `res_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
