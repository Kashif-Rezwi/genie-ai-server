import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CreditsService } from '../services/credits.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';

@Injectable()
export class CreditCleanupTask {
  private readonly logger = new Logger(CreditCleanupTask.name);
  private readonly MAX_CLEANUP_RETRIES = 3;

  constructor(
    private readonly creditsService: CreditsService,
    private readonly eventEmitter: EventEmitter2,
    @InjectRedis() private readonly redis: Redis
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleExpiredReservations() {
    const startTime = Date.now();
    const results = await this.creditsService.cleanupExpiredReservations();

    // Handle failed cleanups
    // Note: cleanupExpiredReservations returns a number, not an object with errors
    // This is a compatibility issue that needs to be addressed

    const duration = Date.now() - startTime;
    this.logger.log(
      `Cleanup completed: ${results} cleaned, duration: ${duration}ms`
    );
  }

  private async handleFailedCleanup(reservationId: string): Promise<void> {
    const retryKey = `cleanup:retry:${reservationId}`;

    try {
      const retryCount = await this.redis.incr(retryKey);
      await this.redis.expire(retryKey, 86400); // 24 hour expiry

      if (retryCount > this.MAX_CLEANUP_RETRIES) {
        // Alert for manual intervention
        this.eventEmitter.emit('cleanup.manual_intervention_needed', {
          reservationId,
          retryCount,
          timestamp: new Date(),
        });

        // Clean up retry counter
        await this.redis.del(retryKey);

        this.logger.error(
          `Reservation ${reservationId} cleanup failed after ${retryCount} retries`
        );
      } else {
        this.logger.warn(`Reservation ${reservationId} cleanup failed, retry count: ${retryCount}`);
      }
    } catch (error) {
      this.logger.error(`Error handling failed cleanup for ${reservationId}:`, error);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async performDeepCleanup() {
    this.logger.log('Starting deep cleanup of stuck reservations');

    // Clean up orphaned Redis keys
    const allReservations = await this.redis.keys('reservation:*:*');
    let orphaned = 0;

    for (const key of allReservations) {
      try {
        const data = await this.redis.get(key);
        if (!data) {
          await this.redis.del(key);
          orphaned++;
          continue;
        }

        const reservation = JSON.parse(data);
        const age = Date.now() - new Date(reservation.createdAt || 0).getTime();

        // Force cleanup if older than 24 hours
        if (age > 86400000) {
          await this.creditsService.releaseReservation(reservation.id);
          orphaned++;
        }
      } catch (error) {
        this.logger.error(`Error in deep cleanup for ${key}:`, error);
      }
    }

    this.logger.log(`Deep cleanup completed: ${orphaned} orphaned reservations cleaned`);
  }
}
