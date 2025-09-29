import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreditsModule } from '../credits/credits.module';
import { AIController } from './ai.controller';
import { AIService } from './services/ai.service';
import { AICreditService } from './services/ai-credit.service';
import { AIProviderFactory } from './providers/ai-provider.factory';
import { User, CreditTransaction } from '../../entities';

@Module({
    imports: [TypeOrmModule.forFeature([User, CreditTransaction]), CreditsModule],
    controllers: [AIController],
    providers: [AIService, AICreditService, AIProviderFactory],
    exports: [AIService],
})
export class AIModule {}
