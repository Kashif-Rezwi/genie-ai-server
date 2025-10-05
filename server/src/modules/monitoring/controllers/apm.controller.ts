import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard, Roles, UserRole } from '../../security/guards/roles.guard';
import { ApiResponseDto } from '../../../common/dto/api-response.dto';
import { APMService } from '../services/apm.service';

@Controller('monitoring/apm')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class APMController {
  constructor(private readonly apmService: APMService) {}

  @Get('metrics')
  async getAPMMetrics(): Promise<ApiResponseDto> {
    const metrics = this.apmService.getMetrics();
    return {
      success: true,
      message: 'APM metrics retrieved successfully',
      data: metrics,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('transactions')
  async getTransactions(@Query('limit') limit = 100): Promise<ApiResponseDto> {
    const transactions = this.apmService.getRecentTransactions(limit);
    return {
      success: true,
      message: 'APM transactions retrieved successfully',
      data: transactions,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('transactions/:id')
  async getTransaction(@Param('id') id: string): Promise<ApiResponseDto> {
    const transaction = this.apmService.getTransaction(id);
    if (!transaction) {
      return {
        success: false,
        message: 'Transaction not found',
        data: null,
        timestamp: new Date().toISOString(),
      };
    }

    const spans = this.apmService.getSpansForTransaction(id);
    return {
      success: true,
      message: 'APM transaction retrieved successfully',
      data: { transaction, spans },
      timestamp: new Date().toISOString(),
    };
  }

  @Get('spans/:id')
  async getSpan(@Param('id') id: string): Promise<ApiResponseDto> {
    const span = this.apmService.getSpan(id);
    if (!span) {
      return {
        success: false,
        message: 'Span not found',
        data: null,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: true,
      message: 'APM span retrieved successfully',
      data: span,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('errors/:id')
  async getError(@Param('id') id: string): Promise<ApiResponseDto> {
    const error = this.apmService.getError(id);
    if (!error) {
      return {
        success: false,
        message: 'Error not found',
        data: null,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: true,
      message: 'APM error retrieved successfully',
      data: error,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('users/:userId/transactions')
  async getUserTransactions(
    @Param('userId') userId: string,
    @Query('limit') limit = 100
  ): Promise<ApiResponseDto> {
    const transactions = this.apmService.getRecentTransactions(limit);
    return {
      success: true,
      message: 'User transactions retrieved successfully',
      data: transactions,
      timestamp: new Date().toISOString(),
    };
  }
}
