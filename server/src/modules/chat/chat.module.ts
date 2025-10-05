import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './services/chat.service';
import { MessageService } from './services/message.service';
import { ChatStreamingService } from './services/chat-streaming.service';
import { AIModule } from '../ai/ai.module';
import { CreditsModule } from '../credits/credits.module';
import { SecurityModule } from '../security/security.module';

@Module({
  imports: [
    AIModule,
    CreditsModule,
    SecurityModule,
  ],
  controllers: [ChatController],
  providers: [ChatService, MessageService, ChatStreamingService],
  exports: [ChatService, MessageService],
})
export class ChatModule {}
