import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiKey, ApiKeyStatus, ApiKeyType, User } from '../../../entities';
import { SecurityService } from './security.service';

export interface CreateApiKeyDto {
    name: string;
    type?: ApiKeyType;
    permissions?: string[];
    expiresAt?: Date;
    rateLimits?: {
        requestsPerMinute: number;
        requestsPerHour: number;
        requestsPerDay: number;
    };
}

@Injectable()
export class ApiKeyService {
    constructor(
        @InjectRepository(ApiKey)
        private readonly apiKeyRepository: Repository<ApiKey>,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        private readonly securityService: SecurityService,
    ) {}

    async createApiKey(
        userId: string,
        createDto: CreateApiKeyDto,
    ): Promise<{
        apiKey: string;
        keyId: string;
        expiresAt: Date | null;
    }> {
        // Verify user exists
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user) {
            throw new BadRequestException('User not found');
        }

        // Check if user already has too many API keys
        const existingKeys = await this.apiKeyRepository.count({
            where: { userId, status: ApiKeyStatus.ACTIVE },
        });

        if (existingKeys >= 5) {
            throw new BadRequestException('Maximum API keys limit reached (5)');
        }

        // Generate API key
        const rawApiKey = this.securityService.generateApiKey();
        const keyHash = this.securityService.hashApiKey(rawApiKey);

        // Set default expiration (1 year)
        const defaultExpiration = new Date();
        defaultExpiration.setFullYear(defaultExpiration.getFullYear() + 1);

        // Create API key record
        const apiKey = this.apiKeyRepository.create({
            keyHash,
            name: createDto.name,
            type: createDto.type || ApiKeyType.USER,
            userId,
            permissions: createDto.permissions || ['api:read'],
            rateLimits: createDto.rateLimits || {
                requestsPerMinute: 60,
                requestsPerHour: 1000,
                requestsPerDay: 10000,
            },
            expiresAt: createDto.expiresAt || defaultExpiration,
            status: ApiKeyStatus.ACTIVE,
            usageCount: 0,
            metadata: {
                createdFrom: 'api',
                userAgent: 'unknown',
            },
        });

        const savedKey = await this.apiKeyRepository.save(apiKey);

        return {
            apiKey: rawApiKey,
            keyId: savedKey.id,
            expiresAt: savedKey.expiresAt,
        };
    }

    async validateApiKey(rawApiKey: string): Promise<{
        isValid: boolean;
        apiKey?: ApiKey;
        user?: User;
    }> {
        try {
            const keyHash = this.securityService.hashApiKey(rawApiKey);

            const apiKey = await this.apiKeyRepository.findOne({
                where: { keyHash, status: ApiKeyStatus.ACTIVE },
                relations: ['user'],
            });

            if (!apiKey) {
                return { isValid: false };
            }

            // Check expiration
            if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
                // Auto-revoke expired key
                apiKey.status = ApiKeyStatus.INACTIVE;
                await this.apiKeyRepository.save(apiKey);
                return { isValid: false };
            }

            // Check if user is active
            if (!apiKey.user.isActive) {
                return { isValid: false };
            }

            // Update usage
            apiKey.lastUsedAt = new Date();
            apiKey.usageCount = (apiKey.usageCount || 0) + 1;
            await this.apiKeyRepository.save(apiKey);

            return {
                isValid: true,
                apiKey,
                user: apiKey.user,
            };
        } catch (error) {
            console.error('API key validation error:', error);
            return { isValid: false };
        }
    }

    async revokeApiKey(keyId: string, userId: string): Promise<void> {
        const apiKey = await this.apiKeyRepository.findOne({
            where: { id: keyId, userId },
        });

        if (!apiKey) {
            throw new BadRequestException('API key not found');
        }

        apiKey.status = ApiKeyStatus.REVOKED;
        await this.apiKeyRepository.save(apiKey);
    }

    async getUserApiKeys(userId: string): Promise<
        Array<{
            id: string;
            name: string;
            type: string;
            status: string;
            lastUsedAt: Date | null;
            usageCount: number;
            expiresAt: Date | null;
            createdAt: Date;
        }>
    > {
        const apiKeys = await this.apiKeyRepository.find({
            where: { userId },
            order: { createdAt: 'DESC' },
        });

        return apiKeys.map(key => ({
            id: key.id,
            name: key.name,
            type: key.type,
            status: key.status,
            lastUsedAt: key.lastUsedAt,
            usageCount: key.usageCount,
            expiresAt: key.expiresAt,
            createdAt: key.createdAt,
        }));
    }

    async getApiKeyStats(): Promise<{
        totalKeys: number;
        activeKeys: number;
        revokedKeys: number;
        expiredKeys: number;
        totalUsage: number;
    }> {
        const stats = await this.apiKeyRepository
            .createQueryBuilder('apiKey')
            .select([
                'COUNT(*) as totalKeys',
                'SUM(CASE WHEN apiKey.status = :active THEN 1 ELSE 0 END) as activeKeys',
                'SUM(CASE WHEN apiKey.status = :revoked THEN 1 ELSE 0 END) as revokedKeys',
                'SUM(CASE WHEN apiKey.expiresAt < NOW() THEN 1 ELSE 0 END) as expiredKeys',
                'SUM(apiKey.usageCount) as totalUsage',
            ])
            .setParameters({
                active: ApiKeyStatus.ACTIVE,
                revoked: ApiKeyStatus.REVOKED,
            })
            .getRawOne();

        return {
            totalKeys: parseInt(stats.totalKeys) || 0,
            activeKeys: parseInt(stats.activeKeys) || 0,
            revokedKeys: parseInt(stats.revokedKeys) || 0,
            expiredKeys: parseInt(stats.expiredKeys) || 0,
            totalUsage: parseInt(stats.totalUsage) || 0,
        };
    }

    async hasPermission(apiKey: ApiKey, permission: string): Promise<boolean> {
        if (!apiKey.permissions) return false;

        // Check exact permission or wildcard
        return (
            apiKey.permissions.includes(permission) ||
            apiKey.permissions.includes('*') ||
            apiKey.permissions.some(p => p.endsWith('*') && permission.startsWith(p.slice(0, -1)))
        );
    }
}
