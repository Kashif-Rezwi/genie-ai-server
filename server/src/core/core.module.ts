import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User, Chat, Message, CreditTransaction, Payment, CreditAuditLog } from '../entities';
import { UserRepository } from './repositories/user.repository';
import { ChatRepository } from './repositories/chat.repository';
import { MessageRepository } from './repositories/message.repository';
import { CreditTransactionRepository } from './repositories/credit-transaction.repository';
import { PaymentRepository } from './repositories/payment.repository';
import { CreditAuditLogRepository } from './repositories/credit-audit-log.repository';

/**
 * Core Module
 * Provides shared services and repositories across the application
 * This module should be imported by all other modules that need data access
 */
@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Chat,
      Message,
      CreditTransaction,
      Payment,
      CreditAuditLog,
    ]),
  ],
  providers: [
    // Repository implementations
    UserRepository,
    ChatRepository,
    MessageRepository,
    CreditTransactionRepository,
    PaymentRepository,
    CreditAuditLogRepository,
  ],
  exports: [
    // Export repositories for use in other modules
    UserRepository,
    ChatRepository,
    MessageRepository,
    CreditTransactionRepository,
    PaymentRepository,
    CreditAuditLogRepository,
  ],
})
export class CoreModule {}
