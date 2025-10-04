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
}

export function validateEnvironment(config: Record<string, unknown>) {
    const validatedConfig = plainToClass(EnvironmentVariables, config, {
        enableImplicitConversion: true,
    });

    const errors = validateSync(validatedConfig, {
        skipMissingProperties: false,
    });

    if (errors.length > 0) {
        const errorMessages = errors.map(error => 
            Object.values(error.constraints || {}).join(', ')
        ).join('; ');
        
        throw new Error(`Environment validation failed: ${errorMessages}`);
    }

    return validatedConfig;
}
