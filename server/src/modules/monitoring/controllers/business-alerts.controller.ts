import { Controller, Get, Post, Put, Delete, Param, Query, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard, Roles, UserRole } from '../../security/guards/roles.guard';
import { ApiResponseDto } from '../../../common/dto/api-response.dto';
import { BusinessAlertsService } from '../services/business-alerts.service';

@Controller('monitoring/alerts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class BusinessAlertsController {
  constructor(private readonly businessAlertsService: BusinessAlertsService) {}

  @Get('rules')
  async getAlertRules(): Promise<ApiResponseDto> {
    const rules = this.businessAlertsService.getRules();
    return {
      success: true,
      message: 'Alert rules retrieved successfully',
      data: rules,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('rules/:id')
  async getAlertRule(@Param('id') id: string): Promise<ApiResponseDto> {
    const rule = this.businessAlertsService.getRule(id);
    if (!rule) {
      return {
        success: false,
        message: 'Alert rule not found',
        data: null,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: true,
      message: 'Alert rule retrieved successfully',
      data: rule,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('rules')
  async createAlertRule(@Body() ruleData: any): Promise<ApiResponseDto> {
    const rule = this.businessAlertsService.createRule(ruleData);
    return {
      success: true,
      message: 'Alert rule created successfully',
      data: rule,
      timestamp: new Date().toISOString(),
    };
  }

  @Put('rules/:id')
  async updateAlertRule(@Param('id') id: string, @Body() ruleData: any): Promise<ApiResponseDto> {
    const rule = this.businessAlertsService.updateRule(id, ruleData);
    if (!rule) {
      return {
        success: false,
        message: 'Alert rule not found',
        data: null,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: true,
      message: 'Alert rule updated successfully',
      data: rule,
      timestamp: new Date().toISOString(),
    };
  }

  @Delete('rules/:id')
  async deleteAlertRule(@Param('id') id: string): Promise<ApiResponseDto> {
    const deleted = this.businessAlertsService.deleteRule(id);
    if (!deleted) {
      return {
        success: false,
        message: 'Alert rule not found',
        data: null,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: true,
      message: 'Alert rule deleted successfully',
      data: { id },
      timestamp: new Date().toISOString(),
    };
  }

  @Post('evaluate')
  async evaluateAlerts(): Promise<ApiResponseDto> {
    const results = this.businessAlertsService.evaluateRules();
    return {
      success: true,
      message: 'Alerts evaluated successfully',
      data: results,
      timestamp: new Date().toISOString(),
    };
  }

  @Get()
  async getAlerts(
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('limit') limit = 100
  ): Promise<ApiResponseDto> {
    const alerts = this.businessAlertsService.getAlerts(status, priority);
    return {
      success: true,
      message: 'Alerts retrieved successfully',
      data: alerts,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('stats')
  async getAlertStats(): Promise<ApiResponseDto> {
    const stats = this.businessAlertsService.getAlertStats();
    return {
      success: true,
      message: 'Alert statistics retrieved successfully',
      data: stats,
      timestamp: new Date().toISOString(),
    };
  }

  @Post(':id/acknowledge')
  async acknowledgeAlert(@Param('id') id: string): Promise<ApiResponseDto> {
    const alert = this.businessAlertsService.acknowledgeAlert(id);
    if (!alert) {
      return {
        success: false,
        message: 'Alert not found',
        data: null,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: true,
      message: 'Alert acknowledged successfully',
      data: alert,
      timestamp: new Date().toISOString(),
    };
  }

  @Post(':id/resolve')
  async resolveAlert(@Param('id') id: string): Promise<ApiResponseDto> {
    const alert = this.businessAlertsService.resolveAlert(id);
    if (!alert) {
      return {
        success: false,
        message: 'Alert not found',
        data: null,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: true,
      message: 'Alert resolved successfully',
      data: alert,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('config')
  async getAlertConfig(): Promise<ApiResponseDto> {
    const config = this.businessAlertsService.getConfig();
    return {
      success: true,
      message: 'Alert configuration retrieved successfully',
      data: config,
      timestamp: new Date().toISOString(),
    };
  }

  @Put('config')
  async updateAlertConfig(@Body() configData: any): Promise<ApiResponseDto> {
    const config = this.businessAlertsService.updateConfig(configData);
    return {
      success: true,
      message: 'Alert configuration updated successfully',
      data: config,
      timestamp: new Date().toISOString(),
    };
  }
}
