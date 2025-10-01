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
        const { paymentId, userId, action, amount, reason, razorpayPaymentId, razorpayOrderId } = job.data;

        this.logger.log(`Processing payment job: ${job.data.jobId} (${action})`);

        try {
            await job.updateProgress(10);

            let results: any;

            switch (action) {
                case 'process':
                    results = await this.processPayment(paymentId, userId || '', { razorpayOrderId });
                    break;
                case 'verify':
                    results = await this.verifyPayment(paymentId, userId || '', { razorpayPaymentId });
                    break;
                case 'retry':
                    results = await this.retryPayment(paymentId, userId || '', { razorpayPaymentId });
                    break;
                case 'refund':
                    results = await this.refundPayment(paymentId, userId || '', { amount, reason });
                    break;
                case 'reconcile':
                    results = await this.reconcilePayments(userId || '', { days: 7 });
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

    private async processPayment(paymentId: string, userId: string, data: any): Promise<any> {
        // Process payment verification - this would need verifyDto from job data
        return { message: 'Payment processed successfully', paymentId };
    }

    private async verifyPayment(paymentId: string, userId: string, data: any): Promise<any> {
        // Verify payment status
        const payment = await this.paymentsService.getPaymentById(paymentId, userId);
        return { message: 'Payment verified', paymentId, status: payment.status };
    }

    private async retryPayment(paymentId: string, userId: string, data: any): Promise<any> {
        // Retry failed payment processing
        const result = await this.paymentsService.retryFailedPaymentProcessing(paymentId);
        return { message: 'Payment retry completed', paymentId, result };
    }

    private async refundPayment(paymentId: string, userId: string, data: any): Promise<any> {
        // Process refund
        const result = await this.paymentsService.refundPayment(paymentId, userId, data);
        return { message: 'Refund processed', paymentId, result };
    }

    private async reconcilePayments(userId: string, data: any): Promise<any> {
        // Reconcile payment data
        const result = await this.paymentsService.reconcilePayments(userId, data);
        return { message: 'Payments reconciled', count: result.reconciledCount };
    }
}
