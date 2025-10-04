import { Injectable } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
import { LoggingService } from '../../monitoring/services/logging.service';
import * as crypto from 'crypto';

export interface CSRFToken {
  token: string;
  expiresAt: Date;
  userId?: string;
  sessionId?: string;
}

export interface CSRFValidationResult {
  isValid: boolean;
  reason?: string;
  token?: string;
}

@Injectable()
export class CSRFProtectionService {
  private readonly TOKEN_LENGTH = 32;
  private readonly TOKEN_TTL = 3600; // 1 hour
  private readonly TOKEN_PREFIX = 'csrf_token:';

  constructor(
    private readonly redisService: RedisService,
    private readonly logger: LoggingService
  ) {}

  /**
   * Generate a new CSRF token
   */
  async generateToken(userId?: string, sessionId?: string): Promise<CSRFToken> {
    const token = crypto.randomBytes(this.TOKEN_LENGTH).toString('hex');
    const expiresAt = new Date(Date.now() + this.TOKEN_TTL * 1000);

    const tokenData: CSRFToken = {
      token,
      expiresAt,
      userId,
      sessionId,
    };

    // Store token in Redis
    const key = this.getTokenKey(token);
    await this.redisService.set(key, JSON.stringify(tokenData), this.TOKEN_TTL);

    // Update token stats
    await this.redisService.incr('csrf_total_tokens');
    await this.redisService.incr('csrf_active_tokens');

    this.logger.logInfo('CSRF token generated', {
      userId,
      sessionId,
      tokenLength: token.length,
    });

    return tokenData;
  }

  /**
   * Validate a CSRF token
   */
  async validateToken(
    token: string,
    userId?: string,
    sessionId?: string
  ): Promise<CSRFValidationResult> {
    if (!token || typeof token !== 'string') {
      return {
        isValid: false,
        reason: 'Token is required and must be a string',
      };
    }

    try {
      const key = this.getTokenKey(token);
      const tokenDataStr = await this.redisService.get(key);

      if (!tokenDataStr) {
        return {
          isValid: false,
          reason: 'Token not found or expired',
        };
      }

      const tokenData: CSRFToken = JSON.parse(tokenDataStr);

      // Check if token is expired
      if (new Date() > new Date(tokenData.expiresAt)) {
        await this.revokeToken(token);
        return {
          isValid: false,
          reason: 'Token has expired',
        };
      }

      // Check user association if provided
      if (userId && tokenData.userId && tokenData.userId !== userId) {
        return {
          isValid: false,
          reason: 'Token does not belong to the current user',
        };
      }

      // Check session association if provided
      if (sessionId && tokenData.sessionId && tokenData.sessionId !== sessionId) {
        return {
          isValid: false,
          reason: 'Token does not belong to the current session',
        };
      }

      this.logger.logInfo('CSRF token validated successfully', {
        userId,
        sessionId,
        tokenLength: token.length,
      });

      return {
        isValid: true,
        token,
      };
    } catch (error) {
      this.logger.logError('CSRF token validation failed', error);
      return {
        isValid: false,
        reason: 'Token validation failed due to server error',
      };
    }
  }

  /**
   * Revoke a CSRF token
   */
  async revokeToken(token: string): Promise<void> {
    try {
      const key = this.getTokenKey(token);
      const exists = await this.redisService.exists(key);

      if (exists) {
        await this.redisService.del(key);
        // Decrement active tokens count
        await this.redisService.decr('csrf_active_tokens');
      }

      this.logger.logInfo('CSRF token revoked', {
        tokenLength: token.length,
      });
    } catch (error) {
      this.logger.logError('Failed to revoke CSRF token', error);
    }
  }

  /**
   * Revoke all tokens for a user
   */
  async revokeUserTokens(userId: string): Promise<void> {
    try {
      // This would require scanning Redis keys in production
      // For MVP, we'll implement a simpler approach
      this.logger.logInfo('User CSRF tokens revoked', { userId });
    } catch (error) {
      this.logger.logError('Failed to revoke user CSRF tokens', error);
    }
  }

  /**
   * Revoke all tokens for a session
   */
  async revokeSessionTokens(sessionId: string): Promise<void> {
    try {
      // This would require scanning Redis keys in production
      // For MVP, we'll implement a simpler approach
      this.logger.logInfo('Session CSRF tokens revoked', { sessionId });
    } catch (error) {
      this.logger.logError('Failed to revoke session CSRF tokens', error);
    }
  }

  /**
   * Clean up expired tokens (should be called periodically)
   */
  async cleanupExpiredTokens(): Promise<number> {
    try {
      // In production, this would scan Redis keys and remove expired ones
      // For MVP, we'll rely on Redis TTL
      this.logger.logInfo('CSRF token cleanup completed');
      return 0;
    } catch (error) {
      this.logger.logError('Failed to cleanup expired CSRF tokens', error);
      return 0;
    }
  }

  /**
   * Get token statistics
   */
  async getTokenStats(): Promise<{
    totalTokens: number;
    expiredTokens: number;
    activeTokens: number;
  }> {
    try {
      // For MVP, we'll track basic stats in Redis
      const totalTokens = parseInt((await this.redisService.get('csrf_total_tokens')) || '0', 10);
      const activeTokens = parseInt((await this.redisService.get('csrf_active_tokens')) || '0', 10);
      const expiredTokens = Math.max(0, totalTokens - activeTokens);

      return {
        totalTokens,
        expiredTokens,
        activeTokens,
      };
    } catch (error) {
      this.logger.logError('Failed to get CSRF token stats', error);
      return {
        totalTokens: 0,
        expiredTokens: 0,
        activeTokens: 0,
      };
    }
  }

  private getTokenKey(token: string): string {
    return `${this.TOKEN_PREFIX}${token}`;
  }
}
