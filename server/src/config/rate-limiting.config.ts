// Comprehensive rate limiting configuration for MVP
export interface RateLimitConfig {
    points: number; // Number of requests allowed
    duration: number; // Time window in seconds
    blockDuration?: number; // Block duration in seconds
    execEvenly?: boolean; // Spread requests evenly
}

// User tier definitions
export enum UserTier {
    FREE = 'free',
    BASIC = 'basic',
    PRO = 'pro',
    ADMIN = 'admin',
}

// Comprehensive rate limiting configurations
export const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
    // Global protection (unauthenticated users)
    global: {
        points: 100,
        duration: 60, // 100 requests per minute
        blockDuration: 300, // 5 minutes block
        execEvenly: true,
    },

    // User-based limits by tier
    user_free: {
        points: 100,
        duration: 60, // 100 requests per minute
        blockDuration: 300,
        execEvenly: true,
    },

    user_basic: {
        points: 300,
        duration: 60, // 300 requests per minute
        blockDuration: 300,
        execEvenly: true,
    },

    user_pro: {
        points: 1000,
        duration: 60, // 1000 requests per minute
        blockDuration: 300,
        execEvenly: true,
    },

    user_admin: {
        points: 5000,
        duration: 60, // 5000 requests per minute
        blockDuration: 300,
        execEvenly: true,
    },

    // AI-specific limits by tier
    ai_free: {
        points: 10,
        duration: 3600, // 10 AI requests per hour
        blockDuration: 1800, // 30 minutes block
    },

    ai_basic: {
        points: 50,
        duration: 3600, // 50 AI requests per hour
        blockDuration: 1800,
    },

    ai_pro: {
        points: 200,
        duration: 3600, // 200 AI requests per hour
        blockDuration: 1800,
    },

    ai_admin: {
        points: 1000,
        duration: 3600, // 1000 AI requests per hour
        blockDuration: 1800,
    },

    // Authentication endpoints (brute force protection)
    auth: {
        points: 5,
        duration: 900, // 5 attempts per 15 minutes
        blockDuration: 1800, // 30 minutes block
    },

    // Password reset (extra protection)
    password_reset: {
        points: 3,
        duration: 3600, // 3 attempts per hour
        blockDuration: 3600, // 1 hour block
    },

    // Payment endpoints (fraud protection)
    payment: {
        points: 10,
        duration: 3600, // 10 payment attempts per hour
        blockDuration: 3600,
    },

    // File upload limits
    upload: {
        points: 20,
        duration: 3600, // 20 uploads per hour
        blockDuration: 1800,
    },
};

// Get rate limit configuration by name
export const getRateLimitConfig = (limiterName: string): RateLimitConfig => {
    return (
        RATE_LIMIT_CONFIGS[limiterName] || {
            points: 100,
            duration: 60,
        }
    );
};

// Get all available rate limit configurations
export const getAllRateLimitConfigs = (): Record<string, RateLimitConfig> => {
    return RATE_LIMIT_CONFIGS;
};

// Check if a rate limit configuration exists
export const hasRateLimitConfig = (limiterName: string): boolean => {
    return limiterName in RATE_LIMIT_CONFIGS;
};
