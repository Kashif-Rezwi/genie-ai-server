import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { JobService } from './job.service';
import { RedisService } from '../../redis/redis.service';
import { User, Chat, Message, Payment, CreditTransaction } from '../../../entities';
import { monitoringConfig } from '../../../config';

@Injectable()
export class MaintenanceJobService {
    private readonly logger = new Logger(MaintenanceJobService.name);
    private readonly config = monitoringConfig();

    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        @InjectRepository(Chat)
        private readonly chatRepository: Repository<Chat>,
        @InjectRepository(Message)
        private readonly messageRepository: Repository<Message>,
        @InjectRepository(Payment)
        private readonly paymentRepository: Repository<Payment>,
        @InjectRepository(CreditTransaction)
        private readonly transactionRepository: Repository<CreditTransaction>,
        private readonly jobService: JobService,
        private readonly redisService: RedisService,
        private readonly dataSource: DataSource,
    ) {}

    @Cron(CronExpression.EVERY_DAY_AT_3AM)
    async scheduleDataCleanup() {
        if (this.config.jobs.enabled) {
            await this.jobService.addMaintenanceJob({
                task: 'cleanup',
                targetTable: 'all',
                batchSize: 1000,
                dryRun: false,
            });
        }
    }

    @Cron(CronExpression.EVERY_DAY_AT_2AM)
    async scheduleWeeklyBackup() {
        if (this.config.jobs.enabled) {
            await this.jobService.addMaintenanceJob({
                task: 'backup',
                batchSize: 10000,
                dryRun: false,
            });
        }
    }

    @Cron(CronExpression.EVERY_DAY_AT_1AM)
    async scheduleCreditReconciliation() {
        if (this.config.jobs.enabled) {
            await this.jobService.addMaintenanceJob({
                task: 'reconcile',
                targetTable: 'credit_transactions',
                batchSize: 500,
                dryRun: false,
            });
        }
    }

    @Cron(CronExpression.EVERY_DAY_AT_4AM)
    async schedulePerformanceOptimization() {
        if (this.config.jobs.enabled) {
            await this.jobService.addMaintenanceJob({
                task: 'optimize',
                targetTable: 'all',
                dryRun: false,
            });
        }
    }

    async cleanupOldRecords(
        tableName: string,
        daysOld: number = 90,
        batchSize: number = 1000,
    ): Promise<{
        deletedCount: number;
        tableName: string;
    }> {
        const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
        let deletedCount = 0;

        this.logger.log(`Starting cleanup for ${tableName}, records older than ${daysOld} days`);

        switch (tableName) {
            case 'messages':
                deletedCount = await this.cleanupOldMessages(cutoffDate, batchSize);
                break;
            case 'payments':
                deletedCount = await this.cleanupOldFailedPayments(cutoffDate, batchSize);
                break;
            case 'sessions':
                deletedCount = await this.cleanupExpiredSessions(batchSize);
                break;
            default:
                throw new Error(`Cleanup not implemented for table: ${tableName}`);
        }

        this.logger.log(`Cleanup completed for ${tableName}: ${deletedCount} records deleted`);
        return { deletedCount, tableName };
    }

    async reconcileUserCredits(): Promise<{
        usersChecked: number;
        discrepanciesFound: number;
        fixedCount: number;
    }> {
        let usersChecked = 0;
        let discrepanciesFound = 0;
        let fixedCount = 0;

        const users = await this.userRepository.find();

        for (const user of users) {
            usersChecked++;

            // Calculate actual balance from transactions
            const transactions = await this.transactionRepository.find({
                where: { userId: user.id },
                order: { createdAt: 'ASC' },
            });

            let calculatedBalance = 0;
            for (const transaction of transactions) {
                calculatedBalance += transaction.amount;
            }

            // Check for discrepancy
            const discrepancy = Math.abs(user.creditsBalance - calculatedBalance);
            if (discrepancy > 0.01) {
                // Allow for small floating point differences
                discrepanciesFound++;

                this.logger.warn(
                    `Credit discrepancy found for user ${user.id}: ` +
                        `stored=${user.creditsBalance}, calculated=${calculatedBalance}`,
                );

                // Fix the discrepancy
                user.creditsBalance = calculatedBalance;
                await this.userRepository.save(user);
                fixedCount++;
            }
        }

        this.logger.log(
            `Credit reconciliation completed: ${usersChecked} users checked, ` +
                `${discrepanciesFound} discrepancies found, ${fixedCount} fixed`,
        );

        return { usersChecked, discrepanciesFound, fixedCount };
    }

    async optimizeDatabase(): Promise<{
        tablesOptimized: string[];
        indexesCreated: number;
        statisticsUpdated: boolean;
    }> {
        const tablesOptimized: string[] = [];
        let indexesCreated = 0;

        try {
            // Analyze and optimize tables
            await this.dataSource.query(
                'ANALYZE users, chats, messages, payments, credit_transactions',
            );
            tablesOptimized.push('users', 'chats', 'messages', 'payments', 'credit_transactions');

            // Create missing indexes if they don't exist
            const indexes = [
                'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_chat_id_created_at ON messages(chat_id, created_at)',
                'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_credit_transactions_user_id_created_at ON credit_transactions(user_id, created_at)',
                'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_user_id_status ON payments(user_id, status)',
                'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chats_user_id_updated_at ON chats(user_id, updated_at)',
            ];

            for (const indexQuery of indexes) {
                try {
                    await this.dataSource.query(indexQuery);
                    indexesCreated++;
                } catch (error) {
                    // Index might already exist, continue
                    this.logger.warn(`Index creation skipped: ${error.message}`);
                }
            }

            this.logger.log(
                `Database optimization completed: ${tablesOptimized.length} tables, ${indexesCreated} indexes`,
            );

            return {
                tablesOptimized,
                indexesCreated,
                statisticsUpdated: true,
            };
        } catch (error) {
            this.logger.error('Database optimization failed:', error);
            throw error;
        }
    }

    async performSecurityScan(): Promise<{
        vulnerabilitiesFound: number;
        issuesFixed: number;
        recommendations: string[];
    }> {
        let vulnerabilitiesFound = 0;
        let issuesFixed = 0;
        const recommendations: string[] = [];

        // Check for inactive users with high balances
        const highBalanceInactiveUsers = await this.userRepository
            .createQueryBuilder('user')
            .where('user.creditsBalance > :threshold', { threshold: 1000 })
            .andWhere('user.updatedAt < :cutoff', {
                cutoff: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
            })
            .getCount();

        if (highBalanceInactiveUsers > 0) {
            vulnerabilitiesFound++;
            recommendations.push(
                `${highBalanceInactiveUsers} inactive users with high credit balances found`,
            );
        }

        // Check for orphaned records
        const orphanedMessages = await this.messageRepository
            .createQueryBuilder('message')
            .leftJoin('message.chat', 'chat')
            .where('chat.id IS NULL')
            .getCount();

        if (orphanedMessages > 0) {
            vulnerabilitiesFound++;
            recommendations.push(`${orphanedMessages} orphaned messages found`);
        }

        // Check for suspicious payment patterns
        const suspiciousPayments = await this.paymentRepository
            .createQueryBuilder('payment')
            .where('payment.status = :status', { status: 'pending' })
            .andWhere('payment.createdAt < :cutoff', {
                cutoff: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours old
            })
            .getCount();

        if (suspiciousPayments > 0) {
            vulnerabilitiesFound++;
            recommendations.push(`${suspiciousPayments} payments pending for over 24 hours`);
        }

        this.logger.log(`Security scan completed: ${vulnerabilitiesFound} issues found`);

        return {
            vulnerabilitiesFound,
            issuesFixed,
            recommendations,
        };
    }

    private async cleanupOldMessages(cutoffDate: Date, batchSize: number): Promise<number> {
        let totalDeleted = 0;
        let hasMore = true;

        while (hasMore) {
            // First get IDs to delete
            const idsToDelete = await this.messageRepository
                .createQueryBuilder('message')
                .select('message.id')
                .where('message.createdAt < :cutoffDate', { cutoffDate })
                .andWhere('message.role = :role', { role: 'system' }) // Only delete system messages
                .limit(batchSize)
                .getMany();

            if (idsToDelete.length === 0) {
                hasMore = false;
                break;
            }

            // Then delete by IDs
            const result = await this.messageRepository
                .createQueryBuilder()
                .delete()
                .where('id IN (:...ids)', { ids: idsToDelete.map(m => m.id) })
                .andWhere('role = :role', { role: 'system' }) // Only delete system messages
                .execute();

            totalDeleted += result.affected || 0;
            hasMore = idsToDelete.length === batchSize;

            // Small delay to avoid overwhelming the database
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        return totalDeleted;
    }

    private async cleanupOldFailedPayments(cutoffDate: Date, batchSize: number): Promise<number> {
        let totalDeleted = 0;
        let hasMore = true;

        while (hasMore) {
            // First get IDs to delete
            const idsToDelete = await this.paymentRepository
                .createQueryBuilder('payment')
                .select('payment.id')
                .where('payment.createdAt < :cutoffDate', { cutoffDate })
                .andWhere('payment.status = :status', { status: 'failed' })
                .limit(batchSize)
                .getMany();

            if (idsToDelete.length === 0) {
                hasMore = false;
                break;
            }

            // Then delete by IDs
            const result = await this.paymentRepository
                .createQueryBuilder()
                .delete()
                .where('id IN (:...ids)', { ids: idsToDelete.map(p => p.id) })
                .execute();

            totalDeleted += result.affected || 0;
            hasMore = idsToDelete.length === batchSize;

            await new Promise(resolve => setTimeout(resolve, 100));
        }

        return totalDeleted;
    }

    private async cleanupExpiredSessions(batchSize: number): Promise<number> {
        // Clean up Redis sessions
        const pattern = 'session:*';
        const keys = await this.redisService.getClient().keys(pattern);

        let deletedCount = 0;
        for (let i = 0; i < keys.length; i += batchSize) {
            const batch = keys.slice(i, i + batchSize);

            for (const key of batch) {
                const ttl = await this.redisService.getClient().ttl(key);
                if (ttl === -1) {
                    // No expiration set
                    await this.redisService.del(key);
                    deletedCount++;
                }
            }
        }

        return deletedCount;
    }
}
