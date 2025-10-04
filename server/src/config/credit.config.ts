export const creditConfig = () => ({
    // Cache settings
    cache: {
        ttl: parseInt(process.env.CREDIT_CACHE_TTL || '60', 10), // seconds
        keyPrefix: 'balance:',
    },

    // Reservation settings
    reservation: {
        ttl: parseInt(process.env.CREDIT_RESERVATION_TTL || '300', 10), // 5 minutes
        maxPerUser: parseInt(process.env.MAX_RESERVATIONS_PER_USER || '5', 10),
        maxAmount: parseFloat(process.env.MAX_RESERVATION_AMOUNT || '1000'),
        minAmount: parseFloat(process.env.MIN_RESERVATION_AMOUNT || '0.01'),
        keyPrefix: 'reservation:',
    },

    // Redis settings
    redis: {
        checkInterval: parseInt(process.env.REDIS_CHECK_INTERVAL || '30000', 10), // 30 seconds
        timeout: parseInt(process.env.REDIS_TIMEOUT || '1000', 10), // 1 second
        retryAttempts: parseInt(process.env.REDIS_RETRY_ATTEMPTS || '3', 10),
    },

    // Business rules
    business: {
        minimumBalance: parseFloat(process.env.MIN_CREDIT_BALANCE || '0'),
        maximumBalance: parseFloat(process.env.MAX_CREDIT_BALANCE || '1000000'),
        minimumTransaction: parseFloat(process.env.MIN_CREDIT_TRANSACTION || '0.01'),
        maximumTransaction: parseFloat(process.env.MAX_CREDIT_TRANSACTION || '100000'),
        lowBalanceThreshold: parseFloat(process.env.LOW_BALANCE_THRESHOLD || '10'),
        criticalBalanceThreshold: parseFloat(process.env.CRITICAL_BALANCE_THRESHOLD || '5'),
    },

    // Cleanup settings
    cleanup: {
        batchSize: parseInt(process.env.CLEANUP_BATCH_SIZE || '50', 10),
        maxRetries: parseInt(process.env.CLEANUP_MAX_RETRIES || '3', 10),
        lockTtl: parseInt(process.env.CLEANUP_LOCK_TTL || '30', 10), // seconds
        batchDelay: parseInt(process.env.CLEANUP_BATCH_DELAY || '10', 10), // milliseconds
    },

    // Idempotency settings
    idempotency: {
        defaultTtl: parseInt(process.env.IDEMPOTENCY_TTL || '300', 10), // 5 minutes
        keyPrefix: 'idempotent:',
        resultKeyPrefix: 'idempotent:result:',
    },

    // Performance settings
    performance: {
        maxRetries: parseInt(process.env.MAX_OPERATION_RETRIES || '3', 10),
        baseDelay: parseInt(process.env.OPERATION_BASE_DELAY || '100', 10), // milliseconds
        optimisticLocking: process.env.ENABLE_OPTIMISTIC_LOCKING === 'true',
    },
});

export type CreditConfig = ReturnType<typeof creditConfig>;
