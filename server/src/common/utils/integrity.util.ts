import { Logger } from '@nestjs/common';
import * as crypto from 'crypto';

export class IntegrityUtil {
    private static readonly logger = new Logger(IntegrityUtil.name);

    /**
     * Generate a hash for data integrity verification
     */
    static generateHash(data: string | Buffer, algorithm: string = 'sha256'): string {
        return crypto.createHash(algorithm).update(data).digest('hex');
    }

    /**
     * Verify data integrity using hash comparison
     */
    static verifyIntegrity(
        data: string | Buffer,
        expectedHash: string,
        algorithm: string = 'sha256',
    ): boolean {
        const actualHash = this.generateHash(data, algorithm);
        return actualHash === expectedHash;
    }

    /**
     * Generate a checksum for a file or data
     */
    static generateChecksum(data: string | Buffer): string {
        return this.generateHash(data, 'sha256');
    }

    /**
     * Validate environment configuration integrity
     */
    static validateEnvironmentIntegrity(): boolean {
        try {
            const requiredEnvVars = [
                'NODE_ENV',
                'POSTGRES_HOST',
                'POSTGRES_USER',
                'POSTGRES_PASSWORD',
                'POSTGRES_DB',
                'JWT_SECRET',
            ];

            const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

            if (missingVars.length > 0) {
                this.logger.error(
                    `Missing required environment variables: ${missingVars.join(', ')}`,
                );
                return false;
            }

            // Validate JWT secret strength
            const jwtSecret = process.env.JWT_SECRET;
            if (jwtSecret && jwtSecret.length < 32) {
                this.logger.warn('JWT_SECRET is shorter than recommended (32 characters)');
            }

            return true;
        } catch (error) {
            this.logger.error('Environment integrity validation failed:', error);
            return false;
        }
    }

    /**
     * Validate database connection integrity
     */
    static async validateDatabaseIntegrity(connection: any): Promise<boolean> {
        try {
            // Test basic database connectivity
            await connection.query('SELECT 1');

            // Test if required tables exist
            const tables = ['users', 'chats', 'messages', 'credit_transactions'];
            for (const table of tables) {
                const result = await connection.query(
                    `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '${table}')`,
                );
                if (!result[0].exists) {
                    this.logger.error(`Required table '${table}' does not exist`);
                    return false;
                }
            }

            return true;
        } catch (error) {
            this.logger.error('Database integrity validation failed:', error);
            return false;
        }
    }

    /**
     * Validate Redis connection integrity
     */
    static async validateRedisIntegrity(redisClient: any): Promise<boolean> {
        try {
            const testKey = 'integrity_test_' + Date.now();
            const testValue = 'test_value';

            // Test basic operations
            await redisClient.set(testKey, testValue);
            const retrievedValue = await redisClient.get(testKey);
            await redisClient.del(testKey);

            if (retrievedValue !== testValue) {
                this.logger.error('Redis integrity test failed: value mismatch');
                return false;
            }

            return true;
        } catch (error) {
            this.logger.error('Redis integrity validation failed:', error);
            return false;
        }
    }
}
