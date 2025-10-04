// Simplified rate limiting configuration for 0-1000 users
export interface RateLimitConfig {
    points: number; // Number of requests allowed
    duration: number; // Time window in seconds
}

// Enhanced rate limiting configurations for 0-1000 users
export const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
    // Global protection (unauthenticated users)
    global: {
        points: parseInt(process.env.RATE_LIMIT_GLOBAL_POINTS || '100', 10),
        duration: parseInt(process.env.RATE_LIMIT_GLOBAL_DURATION || '60', 10),
    },

    // User-based limits (authenticated users)
    user: {
        points: parseInt(process.env.RATE_LIMIT_USER_POINTS || '300', 10),
        duration: parseInt(process.env.RATE_LIMIT_USER_DURATION || '60', 10),
    },

    // AI-specific limits (per hour)
    ai: {
        points: parseInt(process.env.RATE_LIMIT_AI_POINTS || '100', 10),
        duration: parseInt(process.env.RATE_LIMIT_AI_DURATION || '3600', 10),
    },

    // API endpoints (general API usage)
    api: {
        points: parseInt(process.env.RATE_LIMIT_API_POINTS || '500', 10),
        duration: parseInt(process.env.RATE_LIMIT_API_DURATION || '60', 10),
    },

    // Payment endpoints (more restrictive)
    payment: {
        points: parseInt(process.env.RATE_LIMIT_PAYMENT_POINTS || '10', 10),
        duration: parseInt(process.env.RATE_LIMIT_PAYMENT_DURATION || '60', 10),
    },

    // AI paid models (higher limits for paid users)
    ai_paid: {
        points: parseInt(process.env.RATE_LIMIT_AI_PAID_POINTS || '200', 10),
        duration: parseInt(process.env.RATE_LIMIT_AI_PAID_DURATION || '3600', 10),
    },

    // Admin endpoints (very high limits)
    admin: {
        points: parseInt(process.env.RATE_LIMIT_ADMIN_POINTS || '1000', 10),
        duration: parseInt(process.env.RATE_LIMIT_ADMIN_DURATION || '60', 10),
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
