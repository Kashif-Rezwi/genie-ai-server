// Simplified rate limiting configuration for 0-1000 users
export interface RateLimitConfig {
    points: number; // Number of requests allowed
    duration: number; // Time window in seconds
}

// Essential rate limiting configurations (simplified for 0-1000 users)
export const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
    // Global protection (unauthenticated users)
    global: {
        points: 100,
        duration: 60, // 100 requests per minute
    },

    // User-based limits (authenticated users)
    user: {
        points: 200,
        duration: 60, // 200 requests per minute
    },

    // AI-specific limits (per hour)
    ai: {
        points: 50,
        duration: 3600, // 50 AI requests per hour
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
