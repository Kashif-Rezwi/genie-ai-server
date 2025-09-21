import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PaymentJobData } from '../interfaces/job.interface';
import { QUEUE_NAMES } from '../constants/queue-names';
import { PaymentsService } from '../../payments/services/payments.service';

@Processor(QUEUE_NAMES.PAYMENT_PROCESSING)
export class PaymentJobProcessor extends WorkerHost {
    private readonly logger = new Logger(PaymentJobProcessor.name);

    constructor(private readonly paymentsService: PaymentsService) {
        super();
    }

    async process(job: Job<PaymentJobData>): Promise<any> {
        const { paymentId, userId, action } = job.data;

        this.logger.log(`Processing payment job: ${job.data.jobId} (${action})`);

        try {
            await job.updateProgress(10);

            // For now, just simulate the payment processing
            // In a real implementation, you'd call the actual payment service methods
            let results: any;

            switch (action) {
                case 'process':
                    results = { message: 'Payment processed', paymentId };
                    break;
                case 'verify':
                    results = { message: 'Payment verified', paymentId };
                    break;
                case 'retry':
                    results = { message: 'Payment retried', paymentId };
                    break;
                case 'refund':
                    results = { message: 'Refund processed', paymentId };
                    break;
                case 'reconcile':
                    results = { message: 'Payments reconciled', count: 0 };
                    break;
                default:
                    throw new Error(`Unknown payment action: ${action}`);
            }

            await job.updateProgress(100);

            return {
                success: true,
                action,
                results,
                timestamp: new Date().toISOString(),
            };

        } catch (error) {
            this.logger.error(`Payment job failed: ${job.data.jobId}`, error);
            throw error;
        }
    }
}
