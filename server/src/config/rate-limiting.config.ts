// Rate limiting configuration
export interface RateLimitConfig {
    points: number;    // Number of requests allowed
    duration: number;  // Time window in seconds
}

// Rate limiting configurations for different user types and operations
export const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
    // Global rate limits
    'global': { 
        points: 1000, 
        duration: 60 
    },
    
    // User tier-based limits (per minute)
    'free_user': { 
        points: 50, 
        duration: 60 
    },
    'basic_user': { 
        points: 200, 
        duration: 60 
    },
    'pro_user': { 
        points: 500, 
        duration: 60 
    },
    'admin_user': { 
        points: 2000, 
        duration: 60 
    },
    
    // AI-specific limits (per hour)
    'ai_free': { 
        points: 10, 
        duration: 3600 
    },
    'ai_paid': { 
        points: 100, 
        duration: 3600 
    },
    
    // Feature-specific limits
    'chat_creation': { 
        points: 20, 
        duration: 3600 
    },
    'payment': { 
        points: 5, 
        duration: 300 
    },
};

// Get rate limit configuration by name
export const getRateLimitConfig = (limiterName: string): RateLimitConfig => {
    return RATE_LIMIT_CONFIGS[limiterName] || { 
        points: 100, 
        duration: 60 
    };
};

// Get all available rate limit configurations
export const getAllRateLimitConfigs = (): Record<string, RateLimitConfig> => {
    return RATE_LIMIT_CONFIGS;
};

// Check if a rate limit configuration exists
export const hasRateLimitConfig = (limiterName: string): boolean => {
    return limiterName in RATE_LIMIT_CONFIGS;
};
