import { Controller, Get, Post, Put, Param, Query, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard, Roles, UserRole } from '../../security/guards/roles.guard';
import { ApiResponseDto } from '../../../common/dto/api-response.dto';
import { CostMonitoringService } from '../services/cost-monitoring.service';

@Controller('monitoring/cost')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class CostMonitoringController {
  constructor(private readonly costMonitoringService: CostMonitoringService) {}

  @Get('metrics')
  async getCostMetrics(@Query('period') period = '30d'): Promise<ApiResponseDto> {
    const metrics = this.costMonitoringService.getCostMetrics();
    return {
      success: true,
      message: 'Cost metrics retrieved successfully',
      data: metrics,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('categories')
  async getCostCategories(): Promise<ApiResponseDto> {
    const categories = this.costMonitoringService.getCategories();
    return {
      success: true,
      message: 'Cost categories retrieved successfully',
      data: categories,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('categories/:id')
  async getCostCategory(@Param('id') id: string): Promise<ApiResponseDto> {
    const category = this.costMonitoringService.getCategory(id);
    if (!category) {
      return {
        success: false,
        message: 'Cost category not found',
        data: null,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: true,
      message: 'Cost category retrieved successfully',
      data: category,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('categories')
  async createCostCategory(@Body() categoryData: any): Promise<ApiResponseDto> {
    const category = this.costMonitoringService.createCategory(categoryData);
    return {
      success: true,
      message: 'Cost category created successfully',
      data: category,
      timestamp: new Date().toISOString(),
    };
  }

  @Put('categories/:id')
  async updateCostCategory(
    @Param('id') id: string,
    @Body() categoryData: any
  ): Promise<ApiResponseDto> {
    const category = this.costMonitoringService.updateCategory(id, categoryData);
    if (!category) {
      return {
        success: false,
        message: 'Cost category not found',
        data: null,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: true,
      message: 'Cost category updated successfully',
      data: category,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('record')
  async recordCost(@Body() costData: any): Promise<ApiResponseDto> {
    const record = this.costMonitoringService.recordCost(
      costData.amount,
      costData.category,
      costData.description,
      costData.units || 1
    );
    return {
      success: true,
      message: 'Cost recorded successfully',
      data: record,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('records')
  async getCostRecords(
    @Query('category') category?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit: string = '100'
  ): Promise<ApiResponseDto> {
    const records = this.costMonitoringService.getRecords(
      category,
      undefined,
      startDate ? new Date(startDate).getTime() : undefined,
      endDate ? new Date(endDate).getTime() : undefined,
      parseInt(limit) || 100
    );
    return {
      success: true,
      message: 'Cost records retrieved successfully',
      data: records,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('budgets')
  async getCostBudgets(): Promise<ApiResponseDto> {
    const budgets = this.costMonitoringService.getBudgets();
    return {
      success: true,
      message: 'Cost budgets retrieved successfully',
      data: budgets,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('budgets/:id')
  async getCostBudget(@Param('id') id: string): Promise<ApiResponseDto> {
    const budget = this.costMonitoringService.getBudget(id);
    if (!budget) {
      return {
        success: false,
        message: 'Cost budget not found',
        data: null,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: true,
      message: 'Cost budget retrieved successfully',
      data: budget,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('budgets')
  async createCostBudget(@Body() budgetData: any): Promise<ApiResponseDto> {
    const budget = this.costMonitoringService.createBudget(budgetData);
    return {
      success: true,
      message: 'Cost budget created successfully',
      data: budget,
      timestamp: new Date().toISOString(),
    };
  }

  @Put('budgets/:id')
  async updateCostBudget(
    @Param('id') id: string,
    @Body() budgetData: any
  ): Promise<ApiResponseDto> {
    const budget = this.costMonitoringService.updateBudget(id, budgetData);
    if (!budget) {
      return {
        success: false,
        message: 'Cost budget not found',
        data: null,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: true,
      message: 'Cost budget updated successfully',
      data: budget,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('alerts')
  async getCostAlerts(): Promise<ApiResponseDto> {
    const alerts = this.costMonitoringService.getAlerts();
    return {
      success: true,
      message: 'Cost alerts retrieved successfully',
      data: alerts,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('alerts/:id/acknowledge')
  async acknowledgeCostAlert(@Param('id') id: string): Promise<ApiResponseDto> {
    const alert = this.costMonitoringService.acknowledgeAlert(id);
    if (!alert) {
      return {
        success: false,
        message: 'Cost alert not found',
        data: null,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: true,
      message: 'Cost alert acknowledged successfully',
      data: alert,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('alerts/:id/resolve')
  async resolveCostAlert(@Param('id') id: string): Promise<ApiResponseDto> {
    const alert = this.costMonitoringService.resolveAlert(id);
    if (!alert) {
      return {
        success: false,
        message: 'Cost alert not found',
        data: null,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: true,
      message: 'Cost alert resolved successfully',
      data: alert,
      timestamp: new Date().toISOString(),
    };
  }
}
