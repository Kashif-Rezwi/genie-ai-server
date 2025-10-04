import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreditsModule } from '../credits/credits.module';
import { SecurityModule } from '../security/security.module';
import { AIController } from './ai.controller';
import { AIService } from './services/ai.service';
import { AIQueueService } from './services/ai-queue.service';
import { AIProviderFactory } from './providers/ai-provider.factory';

@Module({
    imports: [CreditsModule, SecurityModule],
    controllers: [AIController],
    providers: [AIService, AIQueueService, AIProviderFactory],
    exports: [AIService, AIQueueService],
})
export class AIModule {}
