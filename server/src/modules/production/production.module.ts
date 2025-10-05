import { Module } from '@nestjs/common';
import { ProductionReadinessController } from './production-readiness.controller';
import { SecurityAuditService } from '../security/services/security-audit.service';

@Module({
  imports: [],
  controllers: [ProductionReadinessController],
  providers: [
    SecurityAuditService,
  ],
  exports: [
    SecurityAuditService,
    ProductionReadinessController,
  ],
})
export class ProductionModule {}
