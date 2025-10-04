import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ApiDocsController } from './api-docs.controller';

/**
 * API Documentation Module
 * Provides Swagger/OpenAPI documentation and API standards
 */
@Module({
  imports: [ConfigModule],
  controllers: [ApiDocsController],
  exports: [],
})
export class ApiDocsModule {}
