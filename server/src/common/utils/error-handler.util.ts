import { Logger } from '@nestjs/common';

export class ErrorHandlerUtil {
    private static readonly logger = new Logger(ErrorHandlerUtil.name);

    /**
     * Execute a function with error handling and logging
     */
    static async executeWithErrorHandling<T>(
        operation: () => Promise<T>,
        context: string,
        fallback?: T,
    ): Promise<T | undefined> {
        try {
            return await operation();
        } catch (error) {
            this.logger.error(`${context} error:`, error);
            return fallback;
        }
    }

    /**
     * Execute a function with error handling and re-throw
     */
    static async executeWithErrorHandlingAndRethrow<T>(
        operation: () => Promise<T>,
        context: string,
    ): Promise<T> {
        try {
            return await operation();
        } catch (error) {
            this.logger.error(`${context} error:`, error);
            throw error;
        }
    }

    /**
     * Execute a function with retry logic
     */
    static async executeWithRetry<T>(
        operation: () => Promise<T>,
        context: string,
        maxRetries: number = 3,
        delayMs: number = 1000,
    ): Promise<T> {
        let lastError: Error | undefined;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error as Error;
                this.logger.warn(`${context} attempt ${attempt} failed:`, error);

                if (attempt < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
                }
            }
        }

        this.logger.error(`${context} failed after ${maxRetries} attempts:`, lastError);
        throw lastError || new Error(`${context} failed after ${maxRetries} attempts`);
    }
}
