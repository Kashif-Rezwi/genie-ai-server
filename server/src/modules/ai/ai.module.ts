import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AIController } from './ai.controller';
import { AIService } from './services/ai.service';
import { CreditService } from './services/credit.service';
import { OpenAIProvider } from './providers/openai.provider';
import { AnthropicProvider } from './providers/anthropic.provider';
import { GroqProvider } from './providers/groq.provider';
import { User, CreditTransaction } from '../../entities';

@Module({
    imports: [TypeOrmModule.forFeature([User, CreditTransaction])],
    controllers: [AIController],
    providers: [
        AIService,
        CreditService,
        OpenAIProvider,
        AnthropicProvider,
        GroqProvider,
    ],
    exports: [AIService, CreditService],
})
export class AIModule { }