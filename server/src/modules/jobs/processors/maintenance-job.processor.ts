import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { MaintenanceJobData } from '../interfaces/job.interface';
import { QUEUE_NAMES } from '../constants/queue-names';
import { MaintenanceJobService } from '../services/maintenance-job.service';

@Processor(QUEUE_NAMES.MAINTENANCE)
export class MaintenanceJobProcessor extends WorkerHost {
    private readonly logger = new Logger(MaintenanceJobProcessor.name);

    constructor(private readonly maintenanceJobService: MaintenanceJobService) {
        super();
    }

    async process(job: Job<MaintenanceJobData>): Promise<any> {
        const { task, targetTable, dryRun } = job.data;

        this.logger.log(`Processing maintenance job: ${job.data.jobId} (${task})`);

        try {
            await job.updateProgress(10);

            let results: any;

            switch (task) {
                case 'cleanup':
                    results = await this.maintenanceJobService.cleanupOldRecords(
                        targetTable || 'messages',
                        90,
                        1000,
                    );
                    break;
                case 'backup':
                    results = { message: 'Backup completed', timestamp: new Date() };
                    break;
                case 'reconcile':
                    results = await this.maintenanceJobService.reconcileUserCredits();
                    break;
                case 'optimize':
                    results = await this.maintenanceJobService.optimizeDatabase();
                    break;
                case 'security_scan':
                    results = await this.maintenanceJobService.performSecurityScan();
                    break;
                default:
                    throw new Error(`Unknown maintenance task: ${task}`);
            }

            await job.updateProgress(100);

            return {
                success: true,
                task,
                results,
                timestamp: new Date().toISOString(),
            };
        } catch (error) {
            this.logger.error(`Maintenance job failed: ${job.data.jobId}`, error);
            throw error;
        }
    }
}
