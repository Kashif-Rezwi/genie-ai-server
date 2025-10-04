import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Subject, Subscription, from, of } from 'rxjs';
import { mergeMap, delay, catchError, retry } from 'rxjs/operators';
import { LoggingService } from '../../monitoring/services/logging.service';
import { v4 as uuidv4 } from 'uuid';

interface AIRequest {
    id: string;
    userId: string;
    payload: any;
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
    priority: number; // 1 (high) to 5 (low)
    timestamp: number;
    retryCount: number;
    maxRetries: number;
}

@Injectable()
export class AIQueueService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(AIQueueService.name);
    private requestQueue = new Subject<AIRequest>();
    private subscription: Subscription;
    private processing = false;
    private queue: AIRequest[] = [];
    
    // Optimized for 1000 users
    private readonly CONCURRENT_REQUESTS = parseInt(process.env.AI_CONCURRENT_REQUESTS || '10', 10); // Handle 10 concurrent AI requests
    private readonly REQUEST_DELAY_MS = parseInt(process.env.AI_REQUEST_DELAY_MS || '25', 10); // Reduced delay between requests
    private readonly MAX_QUEUE_SIZE = parseInt(process.env.AI_MAX_QUEUE_SIZE || '200', 10); // Increased queue size
    private readonly REQUEST_TIMEOUT = parseInt(process.env.AI_REQUEST_TIMEOUT || '45000', 10); // 45 second timeout
    private readonly BATCH_SIZE = parseInt(process.env.AI_BATCH_SIZE || '5', 10); // Process requests in batches

    constructor(
        private readonly eventEmitter: EventEmitter2,
        private readonly loggingService: LoggingService,
    ) {}

    onModuleInit() {
        this.logger.log('AIQueueService initialized for 1000 user scale');
        this.subscription = this.requestQueue
            .pipe(
                mergeMap(request =>
                    from(this.processRequest(request)).pipe(
                        delay(this.REQUEST_DELAY_MS),
                        retry({
                            count: 2,
                            delay: 1000,
                        }),
                        catchError(error => {
                            this.logger.error(`AI request ${request.id} failed after retries:`, error);
                            request.reject(error);
                            return of(null);
                        })
                    ),
                    this.CONCURRENT_REQUESTS // Limit concurrency
                )
            )
            .subscribe({
                error: (error) => this.logger.error('AIQueueService stream error', error),
                complete: () => this.logger.log('AIQueueService stream completed'),
            });
    }

    onModuleDestroy() {
        this.logger.log('AIQueueService shutting down');
        if (this.subscription) {
            this.subscription.unsubscribe();
        }
    }

    async enqueueRequest(
        userId: string,
        payload: any,
        priority: number = 3,
        maxRetries: number = 2
    ): Promise<any> {
        return new Promise((resolve, reject) => {
            // Check queue size to prevent memory issues
            if (this.queue.length >= this.MAX_QUEUE_SIZE) {
                reject(new Error('AI request queue is full. Please try again later.'));
                return;
            }

            const request: AIRequest = {
                id: uuidv4(),
                userId,
                payload,
                resolve,
                reject,
                priority,
                timestamp: Date.now(),
                retryCount: 0,
                maxRetries,
            };

            // Add to queue and sort by priority
            this.queue.push(request);
            this.queue.sort((a, b) => a.priority - b.priority || a.timestamp - b.timestamp);
            
            this.logger.debug(`Queued AI request ${request.id} for user ${userId} with priority ${priority}`);
            
            // Emit metrics
            this.eventEmitter.emit('ai.queue.enqueued', {
                requestId: request.id,
                userId,
                priority,
                queueSize: this.queue.length,
            });

            this.processNextInQueue();
        });
    }

    private processNextInQueue() {
        if (this.queue.length > 0 && !this.processing) {
            this.processing = true;
            const request = this.queue.shift();
            if (request) {
                this.requestQueue.next(request);
            }
            this.processing = false;
        }
    }

    private async processRequest(request: AIRequest): Promise<void> {
        const startTime = Date.now();
        
        try {
            this.logger.debug(`Processing AI request: ${request.id} for user ${request.userId}`);
            
            // Set timeout for the request
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Request timeout')), this.REQUEST_TIMEOUT);
            });

            // Simulate AI processing with actual timeout
            const result = await Promise.race([
                this.simulateAIProcessing(request),
                timeoutPromise
            ]);

            const duration = Date.now() - startTime;
            
            this.logger.log(`AI request ${request.id} completed in ${duration}ms`);
            
            // Emit success metrics
            this.eventEmitter.emit('ai.queue.completed', {
                requestId: request.id,
                userId: request.userId,
                duration,
                priority: request.priority,
            });

            request.resolve(result);
            
        } catch (error) {
            const duration = Date.now() - startTime;
            
            // Retry logic
            if (request.retryCount < request.maxRetries) {
                request.retryCount++;
                this.logger.warn(`AI request ${request.id} failed, retrying (${request.retryCount}/${request.maxRetries}):`, error.message);
                
                // Add back to queue with higher priority for retry
                request.priority = Math.max(1, request.priority - 1);
                this.queue.unshift(request);
                this.processNextInQueue();
                return;
            }

            this.logger.error(`AI request ${request.id} failed after ${request.maxRetries} retries:`, error);
            
            // Emit failure metrics
            this.eventEmitter.emit('ai.queue.failed', {
                requestId: request.id,
                userId: request.userId,
                duration,
                error: error.message,
                retryCount: request.retryCount,
            });

            request.reject(error);
        } finally {
            this.processNextInQueue();
        }
    }

    private async simulateAIProcessing(request: AIRequest): Promise<any> {
        // Simulate processing time based on priority and content length
        const baseDelay = 1000; // 1 second base
        const priorityMultiplier = 6 - request.priority; // Higher priority = faster processing
        const contentLength = JSON.stringify(request.payload).length;
        const contentDelay = Math.min(contentLength * 0.1, 2000); // Max 2 seconds for content
        
        const totalDelay = (baseDelay / priorityMultiplier) + contentDelay + Math.random() * 1000;
        
        await new Promise(resolve => setTimeout(resolve, totalDelay));
        
        return {
            requestId: request.id,
            userId: request.userId,
            content: `AI response for request ${request.id}`,
            processingTime: totalDelay,
            timestamp: new Date().toISOString(),
        };
    }

    // Queue management methods
    getQueueStatus() {
        return {
            queueSize: this.queue.length,
            processing: this.processing,
            maxConcurrent: this.CONCURRENT_REQUESTS,
            maxQueueSize: this.MAX_QUEUE_SIZE,
        };
    }

    clearQueue() {
        const clearedCount = this.queue.length;
        this.queue.forEach(request => {
            request.reject(new Error('Queue cleared'));
        });
        this.queue = [];
        this.logger.log(`Cleared ${clearedCount} requests from queue`);
        return clearedCount;
    }

    getUserQueueStatus(userId: string) {
        const userRequests = this.queue.filter(req => req.userId === userId);
        return {
            userQueueSize: userRequests.length,
            totalQueueSize: this.queue.length,
            userRequests: userRequests.map(req => ({
                id: req.id,
                priority: req.priority,
                timestamp: req.timestamp,
                retryCount: req.retryCount,
            })),
        };
    }
}
