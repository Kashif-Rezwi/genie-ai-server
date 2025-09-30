import {
    Injectable,
    NotFoundException,
    ConflictException,
    Logger,
    BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, OptimisticLockVersionMismatchError } from 'typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { User, CreditTransaction, TransactionType, CreditAuditLog } from '../../../entities';
import { v4 as uuidv4 } from 'uuid';
import { TransactionMetadataValidator } from '../interfaces/transaction-metadata.interface';
import { creditConfig } from '../../../config';

export interface CreditReservation {
    id: string;
    userId: string;
    amount: number;
    status: 'pending' | 'confirmed' | 'released';
    expiresAt: Date;
    metadata?: Record<string, any>;
}

@Injectable()
export class CreditsService {
    private readonly logger = new Logger(CreditsService.name);
    private readonly config = creditConfig();

    // Redis resilience
    private redisAvailable: boolean = true;
    private redisLastCheck: Date = new Date();

    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        @InjectRepository(CreditTransaction)
        private readonly transactionRepository: Repository<CreditTransaction>,
        @InjectRepository(CreditAuditLog)
        private readonly auditRepository: Repository<CreditAuditLog>,
        private readonly dataSource: DataSource,
        @InjectRedis() private readonly redis: Redis,
        private readonly eventEmitter: EventEmitter2,
    ) {}

    // CORE METHOD 1: Get balance with caching
    async getBalance(userId: string): Promise<number> {
        const startTime = Date.now();
        
        if (!userId || typeof userId !== 'string') {
            this.logger.warn(`Invalid user ID provided to getBalance: ${userId}`);
            throw new BadRequestException('Invalid user ID');
        }

        this.logger.debug(`Getting balance for user ${userId}`);

        // Check if we should retry Redis
        if (!this.redisAvailable) {
            const timeSinceLastCheck = Date.now() - this.redisLastCheck.getTime();
            if (timeSinceLastCheck > this.config.redis.checkInterval) {
                this.redisAvailable = true; // Try Redis again
            }
        }

        if (this.redisAvailable) {
            try {
                const cached = await Promise.race([
                    this.redis.get(`${this.config.cache.keyPrefix}${userId}`),
                    new Promise<null>((_, reject) =>
                        setTimeout(() => reject(new Error('Redis timeout')), this.config.redis.timeout),
                    ),
                ]);

                if (cached !== null) {
                    const duration = Date.now() - startTime;
                    this.logger.debug(`Balance cache hit for user ${userId} (${duration}ms)`);
                    
                    // Emit metrics event
                    this.eventEmitter.emit('credits.balance.retrieved', {
                        userId,
                        balance: parseFloat(cached),
                        source: 'cache',
                        duration,
                    });
                    
                    return parseFloat(cached);
                }
            } catch (error) {
                this.logger.error('Redis error in getBalance:', error.message);
                this.redisAvailable = false;
                this.redisLastCheck = new Date();
                // Continue to database fallback
            }
        }

        // Database fallback
        const user = await this.userRepository.findOne({
            where: { id: userId },
            select: ['id', 'creditsBalance', 'creditsReserved'],
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        // Try to update cache if Redis is back
        if (this.redisAvailable) {
            try {
                await Promise.race([
                    this.redis.setex(
                        `${this.config.cache.keyPrefix}${userId}`,
                        this.config.cache.ttl,
                        user.creditsBalance.toString(),
                    ),
                    new Promise<void>((_, reject) =>
                        setTimeout(() => reject(new Error('Redis timeout')), this.config.redis.timeout),
                    ),
                ]);
            } catch (error) {
                this.logger.error('Redis cache update failed:', error.message);
                // Don't mark Redis as unavailable for cache writes
            }
        }

        const duration = Date.now() - startTime;
        this.logger.debug(`Balance retrieved from DB for user ${userId}: ${user.creditsBalance} (${duration}ms)`);
        
        // Emit metrics event
        this.eventEmitter.emit('credits.balance.retrieved', {
            userId,
            balance: user.creditsBalance,
            source: 'database',
            duration,
        });

        return user.creditsBalance;
    }

    // CORE METHOD 2: Reserve credits for long operations
    async reserveCredits(
        userId: string,
        amount: number,
        metadata?: Record<string, any>,
    ): Promise<string> {
        const startTime = Date.now();
        
        // Input validation
        if (!userId || typeof userId !== 'string') {
            this.logger.warn(`Invalid user ID provided to reserveCredits: ${userId}`);
            throw new BadRequestException('Invalid user ID');
        }

        this.logger.log(`Reserving ${amount} credits for user ${userId}`);

        // Validate amount
        this.validateCreditAmount(amount, 'reservation');

        if (amount > this.config.reservation.maxAmount) {
            throw new BadRequestException(
                `Reservation amount ${amount} exceeds maximum ${this.config.reservation.maxAmount}`,
            );
        }

        // Check existing reservations for this user
        const userReservationPattern = `reservation:*:${userId}`;
        const existingReservations = await this.redis.keys(userReservationPattern);

        if (existingReservations.length >= this.config.reservation.maxPerUser) {
            throw new ConflictException(
                `User has too many pending operations (max: ${this.config.reservation.maxPerUser})`,
            );
        }

        // Validate metadata
        const validatedMetadata = metadata ? TransactionMetadataValidator.validate(metadata) : {};

        const reservationId = uuidv4();
        this.logger.debug(
            `Reserving ${amount} credits for user ${userId}, reservation: ${reservationId}`,
        );

        return this.dataSource.transaction(async manager => {
            try {
                // Lock user row
                const user = await manager.findOne(User, {
                    where: { id: userId },
                    lock: { mode: 'pessimistic_write' },
                });

                if (!user) {
                    throw new NotFoundException('User not found');
                }

            const availableBalance = user.creditsBalance - (user.creditsReserved || 0);

            if (availableBalance < amount) {
                throw new ConflictException(
                    `Insufficient credits. Required: ${amount}, Available: ${availableBalance}`,
                );
            }

            // Update reserved amount
            user.creditsReserved = (user.creditsReserved || 0) + amount;
            await manager.save(user);

            // Store reservation in Redis with TTL
            const reservation: CreditReservation = {
                id: reservationId,
                userId,
                amount,
                status: 'pending',
                expiresAt: new Date(Date.now() + this.config.reservation.ttl * 1000),
                metadata: validatedMetadata,
            };

            // Store reservation with user ID in key for easier lookup
            const reservationKey = `${this.config.reservation.keyPrefix}${reservationId}:${userId}`;
            await this.redis.setex(
                reservationKey,
                this.config.reservation.ttl,
                JSON.stringify(reservation),
            );

                // Invalidate balance cache using pipeline for better performance
                try {
                    const pipeline = this.redis.pipeline();
                    pipeline.del(`${this.config.cache.keyPrefix}${userId}`);
                    await pipeline.exec();
                } catch (error) {
                    this.logger.error('Redis cache invalidation failed in reserveCredits:', error);
                }

                const duration = Date.now() - startTime;
                this.logger.log(`Successfully reserved ${amount} credits for user ${userId} (${duration}ms)`);
                
                // Emit metrics event
                this.eventEmitter.emit('credits.reserved', {
                    userId,
                    amount,
                    reservationId,
                    duration,
                    metadata,
                });
                
                return reservationId;
            } catch (error) {
                const duration = Date.now() - startTime;
                this.logger.error(`Error in reserveCredits for user ${userId} (${duration}ms):`, error);
                
                // Emit error metrics
                this.eventEmitter.emit('credits.reservation.failed', {
                    userId,
                    amount,
                    error: error.message,
                    duration,
                });
                
                throw error;
            }
        });
    }

    // CORE METHOD 3: Confirm reservation with actual usage
    async confirmReservation(reservationId: string, actualAmount?: number): Promise<void> {
        // Find reservation (check with wildcard since we include userId)
        const keys = await this.redis.keys(`${this.config.reservation.keyPrefix}${reservationId}:*`);
        if (keys.length === 0) {
            throw new NotFoundException('Reservation not found or expired');
        }

        const reservationData = await this.redis.get(keys[0]);
        if (!reservationData) {
            throw new NotFoundException('Reservation not found or expired');
        }
        const reservation: CreditReservation = JSON.parse(reservationData);

        // Validate actual amount
        if (actualAmount !== undefined) {
            this.validateCreditAmount(actualAmount, 'confirmation');

            if (actualAmount > reservation.amount) {
                throw new BadRequestException(
                    `Cannot use ${actualAmount} credits, only ${reservation.amount} reserved`,
                );
            }
        }

        const amountToDeduct = actualAmount ?? reservation.amount;

        await this.dataSource.transaction(async manager => {
            // Lock user row
            const user = await manager.findOne(User, {
                where: { id: reservation.userId },
                lock: { mode: 'pessimistic_write' },
            });

            if (!user) {
                throw new NotFoundException('User not found');
            }

            // Calculate final amounts
            const refundAmount = reservation.amount - amountToDeduct;

            // Update balances
            user.creditsReserved = Math.max(0, (user.creditsReserved || 0) - reservation.amount);
            user.creditsBalance = user.creditsBalance - amountToDeduct;
            await manager.save(user);

            // Create transaction record
            const transaction = manager.create(CreditTransaction, {
                userId: reservation.userId,
                type: TransactionType.USAGE,
                amount: -amountToDeduct,
                balanceAfter: user.creditsBalance,
                description: `AI Usage ${reservation.metadata?.model ? `(${reservation.metadata.model})` : ''}`,
                metadata: reservation.metadata,
            });
            await manager.save(transaction);

            // Clean up reservation (use correct key pattern) with pipeline
            const reservationKey = `${this.config.reservation.keyPrefix}${reservationId}:${reservation.userId}`;
            try {
                const pipeline = this.redis.pipeline();
                pipeline.del(reservationKey);
                pipeline.del(`${this.config.cache.keyPrefix}${reservation.userId}`);
                await pipeline.exec();
            } catch (error) {
                this.logger.error('Redis cleanup failed in confirmReservation:', error);
                // Don't fail the transaction for Redis errors
            }

            // Emit event
            this.eventEmitter.emit('credits.consumed', {
                userId: reservation.userId,
                amount: amountToDeduct,
                balance: user.creditsBalance,
                metadata: reservation.metadata,
            });

            // Check for low balance
            if (user.creditsBalance < 10) {
                this.eventEmitter.emit('credits.low', {
                    userId: reservation.userId,
                    balance: user.creditsBalance,
                });
            }

            // Emit refund event if partial usage
            if (refundAmount > 0) {
                this.eventEmitter.emit('credits.refunded', {
                    userId: reservation.userId,
                    amount: refundAmount,
                    reason: 'partial_usage',
                    reservationId,
                });
            }
        });
    }

    // CORE METHOD 4: Release reservation (on failure)
    async releaseReservation(reservationId: string): Promise<void> {
        // Find reservation (check with wildcard since we include userId)
        const keys = await this.redis.keys(`${this.config.reservation.keyPrefix}${reservationId}:*`);
        if (keys.length === 0) {
            return; // Already expired or released
        }

        const reservationData = await this.redis.get(keys[0]);
        if (!reservationData) {
            return; // Already expired or released
        }

        const reservation: CreditReservation = JSON.parse(reservationData);

        await this.dataSource.transaction(async manager => {
            const user = await manager.findOne(User, {
                where: { id: reservation.userId },
                lock: { mode: 'pessimistic_write' },
            });

            if (!user) {
                return;
            }

            // Release reserved credits
            user.creditsReserved = Math.max(0, (user.creditsReserved || 0) - reservation.amount);
            await manager.save(user);

            // Clean up (use correct key pattern) with pipeline
            const reservationKey = `${this.config.reservation.keyPrefix}${reservationId}:${reservation.userId}`;
            try {
                const pipeline = this.redis.pipeline();
                pipeline.del(reservationKey);
                pipeline.del(`${this.config.cache.keyPrefix}${reservation.userId}`);
                await pipeline.exec();
            } catch (error) {
                this.logger.error('Redis cleanup failed in releaseReservation:', error);
                // Don't fail the transaction for Redis errors
            }
        });
    }

    // SIMPLE METHOD: Direct credit addition (for purchases)
    async addCredits(
        userId: string,
        amount: number,
        description: string,
        paymentId?: string,
        packageId?: string,
    ): Promise<void> {
        // Input validation
        if (!userId || typeof userId !== 'string') {
            throw new BadRequestException('Invalid user ID');
        }
        if (!amount || amount <= 0 || !Number.isFinite(amount)) {
            throw new BadRequestException('Amount must be a positive number');
        }
        if (!description || typeof description !== 'string') {
            throw new BadRequestException('Description is required');
        }

        this.logger.debug(`Adding ${amount} credits to user ${userId}: ${description}`);

        await this.dataSource.transaction(async manager => {
            const user = await manager.findOne(User, {
                where: { id: userId },
                lock: { mode: 'pessimistic_write' },
            });

            if (!user) {
                throw new NotFoundException('User not found');
            }

            const balanceBefore = user.creditsBalance;
            user.creditsBalance += amount;
            const balanceAfter = user.creditsBalance;
            await manager.save(user);

            const transaction = manager.create(CreditTransaction, {
                userId,
                type: TransactionType.PURCHASE,
                amount,
                balanceAfter: user.creditsBalance,
                description,
                razorpayPaymentId: paymentId,
            });
            const savedTransaction = await manager.save(transaction);

            // Create audit log
            await this.createAuditLog(
                userId,
                'add',
                amount,
                balanceBefore,
                balanceAfter,
                {
                    description,
                    paymentId,
                    packageId: packageId || undefined,
                },
                undefined,
                undefined,
                undefined,
                savedTransaction.id,
            );

            // Invalidate cache
            try {
                await this.redis.del(`${this.config.cache.keyPrefix}${userId}`);
            } catch (error) {
                this.logger.error('Redis cache invalidation failed in addCredits:', error);
                // Don't fail the transaction for Redis errors
            }

            // Emit event
            this.eventEmitter.emit('credits.purchased', {
                userId,
                amount,
                balance: user.creditsBalance,
                paymentId,
            });
        });
    }

    // QUERY METHOD: Get recent transactions (simplified)
    async getRecentTransactions(userId: string, limit: number = 10): Promise<CreditTransaction[]> {
        return this.transactionRepository.find({
            where: { userId },
            order: { createdAt: 'DESC' },
            take: limit,
        });
    }

    // UTILITY: Clean up expired reservations (run as cron job)
    async cleanupExpiredReservations(): Promise<{ cleaned: number; errors: string[] }> {
        const pattern = `${this.config.reservation.keyPrefix}*:*`;
        let cleaned = 0;
        const errors: string[] = [];

        try {
            const keys = await this.redis.keys(pattern);
            
            // Process in batches to avoid overwhelming the system
            const batchSize = this.config.cleanup.batchSize;
            for (let i = 0; i < keys.length; i += batchSize) {
                const batch = keys.slice(i, i + batchSize);

                const results = await Promise.allSettled(
                    batch.map(async key => {
                        try {
                            // Use Redis pipeline for better performance
                            const pipeline = this.redis.pipeline();
                            pipeline.get(key);
                            pipeline.ttl(key);
                            const results = await pipeline.exec();
                            
                            if (!results || results[0][1] === null) {
                                return null; // Key doesn't exist
                            }

                            const data = results[0][1] as string;
                            const ttl = results[1][1] as number;
                            
                            // Check if key is expired or has no TTL (shouldn't happen but safety check)
                            if (ttl === -1 || ttl === -2) {
                                await this.redis.del(key);
                                return 'expired';
                            }

                            const reservation: CreditReservation = JSON.parse(data);
                            const now = new Date();
                            const expiresAt = new Date(reservation.expiresAt);
                            
                            if (now > expiresAt) {
                                // Use atomic operation to prevent race conditions
                                const lockKey = `cleanup:lock:${reservation.id}`;
                                const locked = await this.redis.set(lockKey, '1', 'EX', this.config.cleanup.lockTtl, 'NX');
                                
                                if (locked) {
                                    try {
                                        await this.releaseReservation(reservation.id);
                                        return 'cleaned';
                                    } finally {
                                        await this.redis.del(lockKey);
                                    }
                                } else {
                                    return 'locked'; // Another process is handling this
                                }
                            }
                            
                            return 'active';
                        } catch (error) {
                            this.logger.error(`Error cleaning reservation ${key}:`, error);
                            return 'error';
                        }
                    }),
                );

                // Count results
                results.forEach((result, index) => {
                    if (result.status === 'fulfilled') {
                        if (result.value === 'cleaned') {
                            cleaned++;
                        } else if (result.value === 'error') {
                            errors.push(batch[index]);
                        }
                    } else {
                        errors.push(batch[index]);
                    }
                });

                // Small delay between batches to prevent overwhelming the system
                if (i + batchSize < keys.length) {
                    await new Promise(resolve => setTimeout(resolve, this.config.cleanup.batchDelay));
                }
            }
        } catch (error) {
            this.logger.error('Error in cleanupExpiredReservations:', error);
            errors.push('cleanup_failed');
        }

        return { cleaned, errors };
    }

    /**
     * Process payment with idempotency to prevent duplicate credits
     */
    async addCreditsIdempotent(
        userId: string,
        amount: number,
        description: string,
        paymentId: string,
        packageId?: string,
    ): Promise<{ processed: boolean; transaction?: CreditTransaction }> {
        // Check if payment already processed
        const existing = await this.transactionRepository.findOne({
            where: { razorpayPaymentId: paymentId },
        });

        if (existing) {
            this.logger.log(`Payment ${paymentId} already processed for user ${userId}`);
            return { processed: false, transaction: existing };
        }

        // Process new payment
        await this.addCredits(userId, amount, description, paymentId);

        // Get the created transaction
        const transaction = await this.transactionRepository.findOne({
            where: { razorpayPaymentId: paymentId },
            order: { createdAt: 'DESC' },
        });

        return { processed: true, transaction: transaction || undefined };
    }

    /**
     * Generic idempotent operation wrapper
     */
    async processWithIdempotencyKey(
        key: string,
        operation: () => Promise<any>,
        ttl: number = 300,
    ): Promise<{ cached: boolean; result: any }> {
        const lockKey = `idempotent:${key}`;
        const resultKey = `idempotent:result:${key}`;

        // Try to acquire lock
        const locked = await this.redis.set(lockKey, '1', 'EX', ttl, 'NX');

        if (!locked) {
            // Operation in progress or completed, check for cached result
            const cachedResult = await this.redis.get(resultKey);
            if (cachedResult) {
                return { cached: true, result: JSON.parse(cachedResult) };
            }
            throw new ConflictException('Operation already in progress');
        }

        try {
            const result = await operation();

            // Cache successful result
            await this.redis.setex(resultKey, ttl, JSON.stringify(result));

            return { cached: false, result };
        } finally {
            // Keep lock until TTL to prevent race conditions
            // Don't delete immediately
        }
    }

    // Helper method for amount validation
    private validateCreditAmount(amount: number, operation: string): void {
        if (amount === undefined || amount === null) {
            throw new BadRequestException(`Credit amount is required for ${operation}`);
        }

        if (amount <= 0) {
            throw new BadRequestException(`Credit amount must be positive for ${operation}`);
        }

        if (!Number.isFinite(amount)) {
            throw new BadRequestException(`Credit amount must be a valid number for ${operation}`);
        }

        // Check decimal places (max 2)
        const decimalPlaces = (amount.toString().split('.')[1] || '').length;
        if (decimalPlaces > 2) {
            throw new BadRequestException(
                `Credit amount must have maximum 2 decimal places for ${operation}`,
            );
        }

        if (amount > this.config.business.maximumTransaction) {
            throw new BadRequestException(
                `Credit amount ${amount} exceeds maximum limit ${this.config.business.maximumTransaction} for ${operation}`,
            );
        }

        if (amount < this.config.business.minimumTransaction) {
            throw new BadRequestException(
                `Credit amount ${amount} is below minimum limit ${this.config.business.minimumTransaction} for ${operation}`,
            );
        }
    }

    // Retry logic for optimistic lock conflicts
    async executeWithRetry<T>(
        operation: () => Promise<T>,
        maxRetries: number = 3,
        baseDelay: number = 100,
    ): Promise<T> {
        let lastError: Error = new Error('Unknown error');

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                if (error instanceof OptimisticLockVersionMismatchError && attempt < maxRetries) {
                    this.logger.debug(`Optimistic lock conflict, retry attempt ${attempt}`);
                    lastError = error;
                    // Exponential backoff
                    await new Promise(resolve => setTimeout(resolve, baseDelay * attempt));
                    continue;
                }
                throw error;
            }
        }

        throw lastError;
    }

    // Redis health check
    async checkRedisHealth(): Promise<boolean> {
        try {
            await this.redis.ping();
            this.redisAvailable = true;
            return true;
        } catch (error) {
            this.redisAvailable = false;
            this.redisLastCheck = new Date();
            return false;
        }
    }

    // Audit logging
    private async createAuditLog(
        userId: string,
        action: string,
        amount: number,
        balanceBefore: number,
        balanceAfter: number,
        context: Record<string, any> = {},
        reservedBefore?: number,
        reservedAfter?: number,
        reservationId?: string,
        transactionId?: string,
    ): Promise<void> {
        try {
            const auditLog = this.auditRepository.create({
                userId,
                action,
                amount,
                balanceBefore,
                balanceAfter,
                reservedBefore,
                reservedAfter,
                reservationId,
                transactionId,
                context: {
                    ...context,
                    timestamp: new Date().toISOString(),
                    service: 'CreditsService',
                },
            });

            await this.auditRepository.save(auditLog);
        } catch (error) {
            // Log error but don't fail the operation
            this.logger.error('Failed to create audit log:', error);
        }
    }

    // Business logic methods
    async canUserAccessPaidModels(userId: string): Promise<boolean> {
        try {
            const balance = await this.getBalance(userId);
            return balance >= 1; // Minimum 1 credit for paid models
        } catch (error) {
            this.logger.error(`Error checking paid model access for user ${userId}:`, error);
            return false;
        }
    }

    async getUserCreditStatus(userId: string): Promise<{
        balance: number;
        reserved: number;
        available: number;
        status: 'healthy' | 'low' | 'critical' | 'exhausted';
        canUsePaidModels: boolean;
    }> {
        const user = await this.userRepository.findOne({
            where: { id: userId },
            select: ['creditsBalance', 'creditsReserved'],
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        const balance = user.creditsBalance;
        const reserved = user.creditsReserved || 0;
        const available = balance - reserved;

        let status: 'healthy' | 'low' | 'critical' | 'exhausted';
        if (available <= 0) {
            status = 'exhausted';
        } else if (available <= this.config.business.criticalBalanceThreshold) {
            status = 'critical';
        } else if (available <= this.config.business.lowBalanceThreshold) {
            status = 'low';
        } else {
            status = 'healthy';
        }

        return {
            balance,
            reserved,
            available,
            status,
            canUsePaidModels: available >= 1,
        };
    }

    // Enhanced deduction with safeguards
    async deductCredits(
        userId: string,
        amount: number,
        description: string,
        metadata?: Record<string, any>,
    ): Promise<void> {
        // Validate amount
        this.validateCreditAmount(amount, 'deduction');

        await this.dataSource.transaction(async manager => {
            const user = await manager.findOne(User, {
                where: { id: userId },
                lock: { mode: 'pessimistic_write' },
            });

            if (!user) {
                throw new NotFoundException('User not found');
            }

            // Never allow negative balance
            if (user.creditsBalance < amount) {
                throw new ConflictException(
                    `Insufficient credits. Required: ${amount}, Available: ${user.creditsBalance}`,
                );
            }

            // Check if this would leave user with critical balance
            const newBalance = user.creditsBalance - amount;
            if (newBalance < this.config.business.criticalBalanceThreshold && newBalance > 0) {
                this.eventEmitter.emit('credits.critical', {
                    userId,
                    balance: newBalance,
                    threshold: this.config.business.criticalBalanceThreshold,
                });
            }

            const balanceBefore = user.creditsBalance;
            user.creditsBalance = newBalance;
            await manager.save(user);

            const transaction = manager.create(CreditTransaction, {
                userId,
                type: TransactionType.USAGE,
                amount: -amount,
                balanceAfter: user.creditsBalance,
                description,
                metadata: metadata ? TransactionMetadataValidator.validate(metadata) : {},
            });
            const savedTransaction = await manager.save(transaction);

            // Create audit log
            await this.createAuditLog(
                userId,
                'deduct',
                amount,
                balanceBefore,
                user.creditsBalance,
                {
                    description,
                    ...metadata,
                },
                undefined,
                undefined,
                undefined,
                savedTransaction.id,
            );

            // Invalidate cache
            try {
                await this.redis.del(`${this.config.cache.keyPrefix}${userId}`);
            } catch (error) {
                this.logger.error('Redis cache invalidation failed in deductCredits:', error);
                // Don't fail the transaction for Redis errors
            }

            // Emit event
            this.eventEmitter.emit('credits.consumed', {
                userId,
                amount,
                balance: user.creditsBalance,
                metadata,
            });
        });
    }

    // Add balance enforcement
    private enforceBalanceLimits(balance: number): number {
        if (balance < this.config.business.minimumBalance) {
            return this.config.business.minimumBalance;
        }
        if (balance > this.config.business.maximumBalance) {
            return this.config.business.maximumBalance;
        }
        return balance;
    }
}
