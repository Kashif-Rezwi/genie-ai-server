export const jwtConfig = () => {
    const secret = process.env.JWT_SECRET;

    if (!secret) {
        throw new Error('JWT_SECRET environment variable is required');
    }

    if (secret.length < 32) {
        throw new Error('JWT_SECRET must be at least 32 characters long for security');
    }

    return {
        secret,
        expiresIn: process.env.JWT_EXPIRES_IN || '24h',
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
        issuer: process.env.JWT_ISSUER || 'genie-ai-server',
        audience: process.env.JWT_AUDIENCE || 'genie-ai-client',
        algorithm: 'HS256' as const,
        clockTolerance: 30, // 30 seconds tolerance for clock skew
        maxAge: parseInt(process.env.JWT_MAX_AGE || '604800000', 10), // 7 days in milliseconds
        refreshSecret: process.env.JWT_REFRESH_SECRET || secret,
        refreshExpiresInMs: parseInt(process.env.JWT_REFRESH_EXPIRES_IN_MS || '604800000', 10), // 7 days
    };
};
