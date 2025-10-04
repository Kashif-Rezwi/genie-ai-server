import { plainToClass, Transform } from 'class-transformer';
import { IsString, IsNumber, IsBoolean, IsOptional, validateSync, Min, Max } from 'class-validator';

class EnvironmentVariables {
    @IsString()
    NODE_ENV: string;

    @IsNumber()
    @Min(1)
    @Max(65535)
    @Transform(({ value }) => parseInt(value, 10))
    PORT: number;

    @IsString()
    POSTGRES_HOST: string;

    @IsNumber()
    @Min(1)
    @Max(65535)
    @Transform(({ value }) => parseInt(value, 10))
    POSTGRES_PORT: number;

    @IsString()
    POSTGRES_USER: string;

    @IsString()
    POSTGRES_PASSWORD: string;

    @IsString()
    POSTGRES_DB: string;

    @IsString()
    REDIS_HOST: string;

    @IsNumber()
    @Min(1)
    @Max(65535)
    @Transform(({ value }) => parseInt(value, 10))
    REDIS_PORT: number;

    @IsOptional()
    @IsString()
    REDIS_PASSWORD?: string;

    @IsString()
    JWT_SECRET: string;

    @IsString()
    JWT_EXPIRES_IN: string;

    @IsOptional()
    @IsString()
    OPENAI_API_KEY?: string;

    @IsOptional()
    @IsString()
    ANTHROPIC_API_KEY?: string;

    @IsOptional()
    @IsString()
    GROQ_API_KEY?: string;

    @IsOptional()
    @IsString()
    RAZORPAY_KEY_ID?: string;

    @IsOptional()
    @IsString()
    RAZORPAY_KEY_SECRET?: string;

    @IsOptional()
    @IsString()
    RAZORPAY_WEBHOOK_SECRET?: string;

    @IsOptional()
    @IsString()
    SMTP_HOST?: string;

    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(65535)
    @Transform(({ value }) => parseInt(value, 10))
    SMTP_PORT?: number;

    @IsOptional()
    @IsString()
    SMTP_USER?: string;

    @IsOptional()
    @IsString()
    SMTP_PASS?: string;

    @IsOptional()
    @IsString()
    LOG_LEVEL?: string;

    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => value === 'true')
    LOG_CONSOLE_ENABLED?: boolean;

    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => value === 'true')
    LOG_FILE_ENABLED?: boolean;

    @IsOptional()
    @IsString()
    LOG_FILE_PATH?: string;

    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(100)
    @Transform(({ value }) => parseInt(value, 10))
    BCRYPT_ROUNDS?: number;

    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(3600)
    @Transform(({ value }) => parseInt(value, 10))
    RATE_LIMIT_TTL?: number;

    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(10000)
    @Transform(({ value }) => parseInt(value, 10))
    RATE_LIMIT_MAX?: number;

    @IsOptional()
    @IsString()
    CORS_ORIGINS?: string;

    @IsOptional()
    @IsString()
    API_KEY_HEADER?: string;

    @IsOptional()
    @IsString()
    MAX_REQUEST_SIZE?: string;

    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => value === 'true')
    ENABLE_RATE_LIMITING?: boolean;

    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => value === 'true')
    SECURITY_HEADERS?: boolean;

    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(50)
    @Transform(({ value }) => parseInt(value, 10))
    AI_CONCURRENT_REQUESTS?: number;

    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(1000)
    @Transform(({ value }) => parseInt(value, 10))
    AI_REQUEST_DELAY_MS?: number;

    @IsOptional()
    @IsNumber()
    @Min(10)
    @Max(1000)
    @Transform(({ value }) => parseInt(value, 10))
    AI_MAX_QUEUE_SIZE?: number;

    @IsOptional()
    @IsNumber()
    @Min(10000)
    @Max(120000)
    @Transform(({ value }) => parseInt(value, 10))
    AI_REQUEST_TIMEOUT?: number;

    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(20)
    @Transform(({ value }) => parseInt(value, 10))
    AI_BATCH_SIZE?: number;

    // Security configuration
    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => value === 'true')
    CSRF_ENABLED?: boolean;

    @IsOptional()
    @IsNumber()
    @Min(16)
    @Max(64)
    @Transform(({ value }) => parseInt(value, 10))
    CSRF_TOKEN_LENGTH?: number;

    @IsOptional()
    @IsNumber()
    @Min(300)
    @Max(7200)
    @Transform(({ value }) => parseInt(value, 10))
    CSRF_TOKEN_TTL?: number;

    @IsOptional()
    @IsString()
    JWT_ISSUER?: string;

    @IsOptional()
    @IsString()
    JWT_AUDIENCE?: string;

    @IsOptional()
    @IsNumber()
    @Min(3600000)
    @Max(2592000000)
    @Transform(({ value }) => parseInt(value, 10))
    JWT_MAX_AGE?: number;

    // Database configuration
    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(100)
    @Transform(({ value }) => parseInt(value, 10))
    DB_POOL_MAX?: number;

    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(50)
    @Transform(({ value }) => parseInt(value, 10))
    DB_POOL_MIN?: number;

    @IsOptional()
    @IsNumber()
    @Min(5000)
    @Max(60000)
    @Transform(({ value }) => parseInt(value, 10))
    DB_CONNECTION_TIMEOUT?: number;

    @IsOptional()
    @IsNumber()
    @Min(10000)
    @Max(120000)
    @Transform(({ value }) => parseInt(value, 10))
    DB_QUERY_TIMEOUT?: number;

    // Redis configuration
    @IsOptional()
    @IsString()
    REDIS_PASSWORD_CONFIG?: string;

    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(15)
    @Transform(({ value }) => parseInt(value, 10))
    REDIS_DB?: number;

    @IsOptional()
    @IsNumber()
    @Min(1000)
    @Max(30000)
    @Transform(({ value }) => parseInt(value, 10))
    DB_CACHE_DURATION?: number;
}

export function validateEnvironment(config: Record<string, unknown>) {
    const validatedConfig = plainToClass(EnvironmentVariables, config, {
        enableImplicitConversion: true,
    });

    const errors = validateSync(validatedConfig, {
        skipMissingProperties: false,
    });

    if (errors.length > 0) {
        const errorDetails = errors.map(error => {
            const property = error.property;
            const constraints = error.constraints || {};
            const value = error.value;

            return {
                property,
                value:
                    typeof value === 'string' && value.length > 50
                        ? `${value.substring(0, 50)}...`
                        : value,
                constraints: Object.values(constraints),
                message: `${property}: ${Object.values(constraints).join(', ')}`,
            };
        });

        const errorMessages = errorDetails.map(detail => detail.message).join('; ');

        // Error details are already logged by the validation framework

        throw new Error(`Environment validation failed: ${errorMessages}`);
    }

    // Additional security checks
    performSecurityChecks(validatedConfig);

    return validatedConfig;
}

function performSecurityChecks(config: EnvironmentVariables): void {
    const warnings: string[] = [];
    const errors: string[] = [];

    // Check JWT secret strength
    if (config.JWT_SECRET && config.JWT_SECRET.length < 32) {
        errors.push('JWT_SECRET must be at least 32 characters long for security');
    }

    // Check password strength requirements
    if (config.BCRYPT_ROUNDS && config.BCRYPT_ROUNDS < 10) {
        warnings.push('BCRYPT_ROUNDS should be at least 10 for better security');
    }

    // Check rate limiting configuration
    if (config.RATE_LIMIT_MAX && config.RATE_LIMIT_MAX > 1000) {
        warnings.push('RATE_LIMIT_MAX is very high, consider reducing for better security');
    }

    // Check database pool configuration
    if (config.DB_POOL_MAX && config.DB_POOL_MIN && config.DB_POOL_MAX < config.DB_POOL_MIN) {
        errors.push('DB_POOL_MAX must be greater than or equal to DB_POOL_MIN');
    }

    // Check AI configuration
    if (config.AI_CONCURRENT_REQUESTS && config.AI_CONCURRENT_REQUESTS > 50) {
        warnings.push('AI_CONCURRENT_REQUESTS is very high, consider reducing for stability');
    }

    // Log warnings (in production, these should be sent to proper logging service)
    if (warnings.length > 0 && process.env.NODE_ENV === 'development') {
        console.warn('Environment configuration warnings:');
        warnings.forEach(warning => console.warn(`  - ${warning}`));
    }

    // Throw errors
    if (errors.length > 0) {
        throw new Error(`Environment security validation failed: ${errors.join('; ')}`);
    }
}
