export const securityConfig = () => ({
    bcrypt: {
        rounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
    },
    rateLimit: {
        ttl: parseInt(process.env.RATE_LIMIT_TTL || '60', 10),
        max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    },
    request: {
        maxSize:
            parseInt(process.env.MAX_REQUEST_SIZE?.replace('mb', '') || '10', 10) * 1024 * 1024,
    },
    apiKey: {
        header: process.env.API_KEY_HEADER || 'x-api-key',
    },
    csrf: {
        enabled: process.env.CSRF_ENABLED === 'true' || process.env.NODE_ENV === 'production',
        tokenLength: parseInt(process.env.CSRF_TOKEN_LENGTH || '32', 10),
        tokenTtl: parseInt(process.env.CSRF_TOKEN_TTL || '3600', 10), // 1 hour
        cookieName: process.env.CSRF_COOKIE_NAME || 'csrf-token',
        headerName: process.env.CSRF_HEADER_NAME || 'x-csrf-token',
        sessionHeaderName: process.env.CSRF_SESSION_HEADER_NAME || 'x-session-id',
    },
    password: {
        minLength: parseInt(process.env.PASSWORD_MIN_LENGTH || '8', 10),
        requireUppercase: process.env.PASSWORD_REQUIRE_UPPERCASE === 'true',
        requireLowercase: process.env.PASSWORD_REQUIRE_LOWERCASE === 'true',
        requireNumbers: process.env.PASSWORD_REQUIRE_NUMBERS === 'true',
        requireSpecialChars: process.env.PASSWORD_REQUIRE_SPECIAL === 'true',
        maxAttempts: parseInt(process.env.PASSWORD_MAX_ATTEMPTS || '5', 10),
        lockoutDuration: parseInt(process.env.PASSWORD_LOCKOUT_DURATION || '900', 10), // 15 minutes
    },
});
