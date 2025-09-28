import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AIJobData } from '../interfaces/job.interface';
import { QUEUE_NAMES } from '../constants/queue-names';
import { AIService } from '../../ai/services/ai.service';

@Processor(QUEUE_NAMES.AI_PROCESSING)
export class AIJobProcessor extends WorkerHost {
    private readonly logger = new Logger(AIJobProcessor.name);

    constructor(private readonly aiService: AIService) {
        super();
    }

    async process(job: Job<AIJobData>): Promise<any> {
        const { userId, chatId, messageId, modelId, messages, options } = job.data;

        this.logger.log(`Processing AI job: ${job.data.jobId}`);

        try {
            await job.updateProgress(10);

            // Create AI request
            const aiRequest = {
                messages,
                model: modelId,
                userId: userId!,
                chatId,
                options,
            };

            await job.updateProgress(30);

            // Generate AI response
            const aiResponse = await this.aiService.generateResponse(userId!, aiRequest);

            await job.updateProgress(80);

            // For now, just return the response
            // In a real implementation, you'd save the message here

            await job.updateProgress(100);

            return {
                success: true,
                messageId: messageId,
                creditsUsed: aiResponse.creditsUsed || 0,
                model: modelId,
            };
        } catch (error) {
            this.logger.error(`AI job failed: ${job.data.jobId}`, error);
            throw error;
        }
    }
}
